import { clone, hash, hashBytes, validate, validateFixture, readRasterFile, type Message, type ObjectValue, type RasterLayer } from '@open-prospector/contracts';

export type Observer = 'asset' | 'mission';
export interface Cell { row: number; column: number }
export interface BeliefCell { known: boolean; obstacle: boolean; elevation_mm: number; uncertainty_mm: number; geofence: boolean; sensed: boolean }
type ReadRaster = (root: string, layer: RasterLayer) => Buffer;

/** An observer capability: unauthorized names fail before invoking the reader. */
export function observerLayers(root: string, input: unknown, observer: Observer, read: ReadRaster = readRasterFile) {
  if (observer !== 'asset' && observer !== 'mission') throw new Error('Invalid observer');
  const manifest = validateFixture(input);
  const allowed = new Map(manifest.layers.filter(layer => layer.scope === `${observer}-initial` || layer.scope === 'public').map(layer => [layer.name, layer]));
  return (name: string): Buffer => {
    const layer = allowed.get(name);
    if (!layer) throw new Error('Observer scope denied');
    // Reader injection supports virtual fixture storage; integrity is never delegated.
    return validateBytes(layer, read(root, clone(layer)));
  };
}
import { validateRaster as validateBytes } from '@open-prospector/contracts';

export interface Belief {
  cell(cell: Cell): Readonly<BeliefCell>;
  stateHash(): string;
}
export interface AssetBelief extends Belief { observe(observation: unknown, tick: number): void }
export interface MissionBelief extends Belief { receive(message: Message, tick: number): void }

function createBelief(root: string, manifest: unknown, observer: Observer, runId: string, assetId: string, read?: ReadRaster) {
  const load = observerLayers(root, manifest, observer, read);
  const elevation = load(`${observer}-initial-elevation`);
  const obstacle = load(`${observer}-initial-obstacles`);
  const known = load(`${observer}-initial-known`);
  const uncertainty = load(`${observer}-initial-uncertainty`);
  const geofence = load('geofence');
  const sensed = Buffer.alloc(known.length);
  const { grid } = validateFixture(manifest);
  const seen = new Set<string>();
  const index = (cell: Cell) => {
    if (!Number.isInteger(cell.row) || !Number.isInteger(cell.column) || cell.row < 0 || cell.row >= grid.rows || cell.column < 0 || cell.column >= grid.columns) throw new Error('Cell outside fixture');
    return cell.row * grid.columns + cell.column;
  };
  for (let i = 0; i < known.length; i++) {
    if (!known[i] && (elevation.readInt32LE(i * 4) !== 0 || obstacle[i])) throw new Error('Unknown initial cell exposes terrain');
    if (known[i] && uncertainty.readUInt32LE(i * 4) !== 0) throw new Error('Known initial elevation has uncertainty');
  }
  let lastTick = -1;
  function apply(input: unknown, tick: number) {
    validate('observation', input);
    const value = clone(input) as ObjectValue;
    if (!Number.isSafeInteger(tick) || tick < lastTick || tick < 0 || value.run_id !== runId || value.asset_id !== assetId || Number(value.observed_tick) > tick || (observer === 'asset' && value.observed_tick !== tick)) throw new Error('Observation identity/time mismatch');
    const id = String(value.observation_id);
    if (seen.has(id)) throw new Error('Duplicate observation');
    const footprint = (value.footprint_cells as unknown as Cell[]).map(index);
    const patches = (value.belief_patch as ObjectValue[]).map(patch => {
      const i = index(patch.cell as unknown as Cell);
      const e = Number(patch.elevation_mm), u = Number(patch.uncertainty_mm);
      if (e < -2147483648 || e > 2147483647 || u > 4294967295) throw new Error('Patch exceeds raster domain');
      return { i, e, u, obstacle: patch.obstacle === true };
    });
    // Commit only after every cell/domain is checked.
    for (const p of patches) {
      elevation.writeInt32LE(p.e, p.i * 4); uncertainty.writeUInt32LE(p.u, p.i * 4);
      known[p.i] = 1; obstacle[p.i] = Number(p.obstacle);
    }
    if (value.truth_contact) for (const i of footprint) sensed[i] = 1;
    seen.add(id);
    lastTick = tick;
  }
  const view: Belief = {
    cell(cell) { const i = index(cell); return Object.freeze({ known: known[i] === 1, obstacle: obstacle[i] === 1, elevation_mm: elevation.readInt32LE(i * 4), uncertainty_mm: uncertainty.readUInt32LE(i * 4), geofence: geofence[i] === 1, sensed: sensed[i] === 1 }); },
    stateHash() { return hash({ elevation: hashBytes(elevation), obstacle: hashBytes(obstacle), known: hashBytes(known), uncertainty: hashBytes(uncertainty), geofence: hashBytes(geofence), sensed: hashBytes(sensed) }); }
  };
  return { view, apply };
}

export function loadAssetFixture(root: string, manifest: unknown, runId: string, assetId: string, read?: ReadRaster): AssetBelief {
  const store = createBelief(root, manifest, 'asset', runId, assetId, read);
  return Object.freeze({ ...store.view, observe: store.apply });
}
export function loadMissionFixture(root: string, manifest: unknown, runId: string, assetId: string, read?: ReadRaster): MissionBelief {
  const store = createBelief(root, manifest, 'mission', runId, assetId, read);
  let lastTick = -1;
  return Object.freeze({ ...store.view, receive(message: Message, tick: number) {
    validate('channel-message', message);
    if (!Number.isSafeInteger(tick) || tick < lastTick || tick !== message.deliver_at_tick || message.sent_tick > tick || message.run_id !== runId || message.direction !== 'asset-to-mission') throw new Error('Message not delivered to this observer');
    if (message.payload_kind === 'observation' && Number(message.payload.observed_tick) > message.sent_tick) throw new Error('Observation sent before it existed');
    if (message.payload_kind === 'observation') store.apply(message.payload, tick);
    lastTick = tick;
  } });
}

/** Called only by the privileged composition root; result contains no hidden metadata. */
export function projectScenario(input: unknown, observer: Observer): ObjectValue {
  if (observer !== 'asset' && observer !== 'mission') throw new Error('Invalid observer');
  validate('scenario', input);
  const source = clone(input) as ObjectValue;
  const flag = `initially_known_to_${observer}`;
  const targets = (source.target_entities as ObjectValue[]).filter(v => v[flag] === true).map(v => ({ entity_id: v.entity_id!, cell: v.cell!, science_class: v.science_class! }));
  const hazards = (source.hazards as ObjectValue[]).filter(v => v[flag] === true).map(v => ({ hazard_id: v.hazard_id!, kind: v.kind!, policy_class: v.policy_class!, cells: v.cells! }));
  const sensors = source.sensors as ObjectValue;
  return clone({ asset: source.asset!, target_entities: targets, hazards, policy: source.policy!, ...(observer === 'asset' ? { sensors: { local_sweep_radius_cells: sensors.local_sweep_radius_cells!, obstacle_range_mm: sensors.obstacle_range_mm!, classifier_seam_id: sensors.classifier_seam_id! } } : { scripted_mission_control: source.scripted_mission_control! }) });
}
