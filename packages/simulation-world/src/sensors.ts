import { clone, edgeLength, sweepFootprint, validate, type ObjectValue } from '@open-prospector/contracts';
import type { Cell } from '@open-prospector/belief';
import type { World } from './index.js';

export interface ObservationMetadata {
  run_id: string; asset_id: string; observation_id: string; observed_tick: number;
}
export interface MotionPose { from_cell: Cell; to_cell: Cell; progress_mm: number }
export interface VisibleHazard {
  hazard_id: string; kind: string; policy_class: string; cells: Cell[];
}
export interface SensorSample {
  observation: ObjectValue;
  discovered_hazards: VisibleHazard[];
  contact: { cell: Cell; distance_mm: number } | null;
}
const key = (cell: Cell) => `${cell.row},${cell.column}`;
const order = (a: Cell, b: Cell) => a.row - b.row || a.column - b.column;
const same = (a: Cell, b: Cell) => a.row === b.row && a.column === b.column;

/** Privileged composition-root factory. Hidden metadata is copied and retained
 * only in the sampler closure. Each sample discloses cells within its footprint. */
export function createSensorAdapter(world: World, input: unknown) {
  validate('scenario', input);
  const scenario = clone(input) as ObjectValue;
  const assetId = (scenario.asset as ObjectValue).asset_id;
  const hazards = scenario.hazards as unknown as VisibleHazard[];
  function sample(cells: Cell[], type: 'local-sweep' | 'obstacle-range', metadata: ObservationMetadata,
    distances?: Map<string, number>): SensorSample {
    if (metadata.asset_id !== assetId) throw new Error('Sensor asset identity mismatch');
    const footprint = [...new Map(cells.map(cell => [key(cell), clone(cell)])).values()].sort(order);
    const contactCandidates: { cell: Cell; distance_mm: number }[] = [];
    const patch = footprint.map(cell => {
      const truth = world.cell(cell.row, cell.column);
      if (truth.obstacle && distances?.has(key(cell))) contactCandidates.push({ cell, distance_mm: distances.get(key(cell))! });
      return { cell, known: true, obstacle: truth.obstacle, elevation_mm: truth.elevation_mm, uncertainty_mm: 0 };
    });
    contactCandidates.sort((a, b) => a.distance_mm - b.distance_mm || order(a.cell, b.cell));
    const contact = contactCandidates[0] ?? null;
    const observation: ObjectValue = {
      schema_version: 'observation-v0', ...metadata,
      sensor_id: type === 'local-sweep' ? 'sensor:local-sweep-v0' : 'sensor:obstacle-range-v0',
      observation_type: type, truth_contact: true,
      footprint_cells: footprint as unknown as ObjectValue[],
      measurements: contact ? [{ name: 'distance-to-contact', value: contact.distance_mm, unit: 'mm', uncertainty_ppm: 0 }] : [],
      belief_patch: patch as unknown as ObjectValue[]
    };
    validate('observation', observation);
    const included = new Set(footprint.map(key));
    const discovered = hazards.flatMap(hazard => {
      const visibleCells = hazard.cells.filter(cell => included.has(key(cell))).sort(order);
      return visibleCells.length ? [{ hazard_id: hazard.hazard_id, kind: hazard.kind, policy_class: hazard.policy_class, cells: visibleCells }] : [];
    }).sort((a, b) => a.hazard_id < b.hazard_id ? -1 : a.hazard_id > b.hazard_id ? 1 : 0);
    return clone({ observation, discovered_hazards: discovered, contact });
  }
  return Object.freeze({
    sweep(center: Cell, metadata: ObservationMetadata): SensorSample {
      return sample(sweepFootprint(center), 'local-sweep', metadata);
    },
    /** Path starts at pose.from_cell, then pose.to_cell. Range is measured to
     * future cell centres; contact subtracts half the final edge. Empty routes
     * at rest belong to the controller, not this moving-pose interface. */
    obstacleRange(pose: MotionPose, path: readonly Cell[], metadata: ObservationMetadata): SensorSample | null {
      if (path.length < 2 || !same(path[0]!, pose.from_cell) || !same(path[1]!, pose.to_cell)) throw new Error('Path does not match motion pose');
      const lengths = path.slice(1).map((cell, i) => edgeLength(path[i]!, cell));
      if (!Number.isSafeInteger(pose.progress_mm) || pose.progress_mm < 0 || pose.progress_mm >= lengths[0]!) throw new Error('Invalid edge progress');
      // Validate the entire route before sampling any truth, even beyond range.
      const distances = new Map<string, number>();
      const footprint: Cell[] = [];
      let remaining = -pose.progress_mm;
      for (let i = 1; i < path.length; i++) {
        const edge = lengths[i - 1]!;
        remaining += edge;
        if (!Number.isSafeInteger(remaining)) throw new Error('Path distance overflow');
        if (remaining > 3000) break;
        const cell = path[i]!;
        footprint.push(cell);
        if (!distances.has(key(cell))) distances.set(key(cell), remaining - Math.floor(edge / 2));
      }
      return footprint.length ? sample(footprint, 'obstacle-range', metadata, distances) : null;
    }
  });
}

/** Integer-only reflex arithmetic. No classifier or model seam is available. */
export function reflexWindow(distance_mm: number, speed_mm_per_tick: number, latency_ticks: number) {
  if (!Number.isSafeInteger(distance_mm) || !Number.isSafeInteger(speed_mm_per_tick) || speed_mm_per_tick < 0
    || !Number.isSafeInteger(latency_ticks) || latency_ticks < 0) throw new Error('Invalid reflex inputs');
  const v = BigInt(speed_mm_per_tick);
  const stopping = v + (v * v + 49n) / 50n;
  if (stopping > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Stopping distance overflow');
  const margin = BigInt(distance_mm) - stopping;
  const ticks = margin <= 0n ? 0n : margin / (v > 0n ? v : 1n);
  return Object.freeze({ distance_mm, speed_mm_per_tick, reaction_ticks: 1, braking_mm_per_tick_squared: 25,
    latency_ticks, stopping_distance_mm: Number(stopping), T: Number(ticks), window_open: 4n * BigInt(latency_ticks) <= ticks });
}
