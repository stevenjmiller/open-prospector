import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { clone, validateFixture, readRasterFile, type Message, type ObjectValue, type RecordEvent } from '@open-prospector/contracts';
import { loadAssetFixture, loadMissionFixture, projectScenario, type Observer, type Cell } from '@open-prospector/belief';
import { verifyCampaign } from '@open-prospector/mission-control';
export { serveCatalog } from './server.js';
export { createCatalog, CatalogError } from './catalog.js';

const endpointTypes = new Set(['directive-received', 'endpoint-state-changed', 'classifier-result-consumed', 'endpoint-fault', 'contestation-opened', 'observation-summarized', 'plan-proposed']);
const missionTypes = new Set(['directive-submitted', 'gatekeeper-evaluated', 'alternative-accepted', 'directive-revised', 'received-belief-updated', 'checkpoint-created', 'run-completed']);

/** Verified, immutable in-memory input. No request can choose files or query truth. */
export async function openArchive(directory: string) {
  const root = resolve(directory);
  const captured = new Map<string, Buffer>();
  const capture = async (name: string) => { const bytes = await readFile(join(root, name)); captured.set(name, bytes); return bytes; };
  const fixtureInput = JSON.parse((await capture('inputs/fixture.json')).toString()) as ObjectValue;
  const fixture = validateFixture(fixtureInput);
  const manifest = JSON.parse((await capture('inputs/manifest.json')).toString()) as ObjectValue;
  const scenario = JSON.parse((await capture('inputs/scenario.json')).toString()) as ObjectValue;
  const directive = JSON.parse((await capture('inputs/directive.json')).toString()) as ObjectValue;
  const telemetryBytes = await capture('telemetry.ndjson');
  await capture('events.ndjson');
  // Scoped initial rasters are captured independently of the privileged verifier.
  const rasters = new Map<string, Buffer>();
  for (const layer of fixture.layers.filter(layer => layer.scope !== 'truth')) {
    const bytes = readRasterFile(join(root, 'fixture'), layer);
    captured.set('fixture/' + layer.path, bytes); rasters.set(layer.name, bytes);
  }
  const verified = await verifyCampaign(root);
  if (verified.status !== 'completed') throw new Error('Viewer requires a verified completed campaign archive.');
  for (const [name, bytes] of captured) {
    if (!bytes.equals(await readFile(join(root, name)))) throw new Error('Archive changed while opening; retry with a stable archive.');
  }
  const messages = telemetryBytes.toString().trimEnd().split('\n').filter(Boolean).map(line => JSON.parse(line) as Message);
  const observations = messages.filter(m => m.direction === 'asset-to-mission' && m.payload_kind === 'observation');
  const informative = observations.filter(m => m.payload.observation_type !== 'local-sweep' &&
    (m.payload.observation_type !== 'obstacle-range' || (m.payload.measurements as unknown[]).length > 0));
  const informativeIds = new Set(informative.map(m => m.payload.observation_id));
  const runId = String(manifest.run_id), assetId = String(directive.asset_id);
  const maxTick = verified.events.at(-1)!.recorded_tick;
  const events = verified.events.filter(e => endpointTypes.has(e.event_type) || missionTypes.has(e.event_type));
  const visibleAt = (event: RecordEvent, observer: Observer) => observer === 'asset' ? event.occurred_tick : (event.received_tick ?? event.occurred_tick);
  const forObserver = (observer: Observer) => events.filter(e => observer === 'mission' || (e.actor_id === assetId && endpointTypes.has(e.event_type)));
  const chapters: { tick: number; label: string }[] = [{ tick: 0, label: 'Start' }];
  const offer = events.find(e => e.event_type === 'contestation-opened' && e.payload.level === 2);
  const reflex = events.find(e => e.event_type === 'contestation-opened' && e.payload.level === 0);
  const final = observations.find(m => m.payload.observation_type === 'standoff-image');
  if (offer) chapters.push({ tick: offer.received_tick!, label: 'Offer reaches mission' });
  if (reflex) chapters.push({ tick: reflex.occurred_tick, label: 'Onboard decision' });
  if (final) chapters.push({ tick: final.deliver_at_tick, label: 'Science reaches mission' });
  chapters.push({ tick: maxTick, label: 'Archive closes' });
  const session = {
    archive_name: basename(root), run_id: runId, fixture_id: fixture.fixture_id,
    status: verified.status, chain_head: verified.head, max_tick: maxTick,
    tick_ms: Number((manifest.clock as ObjectValue).tick_ms), chapters,
    limits: [
      'Read-only, retrospective archive. Chapter labels preview the mission story.',
      'Routes are plans, not a recorded position trace. Budgets are last reported cumulative totals.',
      'Onboard knowledge is reconstructed from archived observations; mission knowledge changes on full delivery.',
      'This campaign uses synthetic terrain, separate from the reviewed Candor crop.',
      'Classifier confidence is a frozen test value, not measured accuracy.'
    ]
  };
  function view(tick: number, observer: Observer) {
    if (!Number.isSafeInteger(tick) || tick < 0 || tick > maxTick) throw new Error('Tick must be an integer within this archive.');
    if (observer !== 'asset' && observer !== 'mission') throw new Error('Observer must be asset or mission.');
    const reader = (_root: string, layer: { name: string }) => {
      const bytes = rasters.get(layer.name); if (!bytes) throw new Error('Observer raster unavailable'); return Buffer.from(bytes);
    };
    const asset = observer === 'asset' ? loadAssetFixture('', fixtureInput, runId, assetId, reader) : undefined;
    const mission = observer === 'mission' ? loadMissionFixture('', fixtureInput, runId, assetId, reader) : undefined;
    const belief = asset ?? mission!;
    const time = (m: Message) => observer === 'asset' ? Number(m.payload.observed_tick) : m.deliver_at_tick;
    const delivered = observations.filter(m => time(m) <= tick).sort((a, b) => time(a) - time(b) || a.creation_ordinal - b.creation_ordinal);
    for (const m of delivered) {
      if (asset) asset.observe(m.payload, time(m)); else mission!.receive(m, time(m));
    }
    const visibleEvents = forObserver(observer).filter(e => visibleAt(e, observer) <= tick)
      .sort((a, b) => visibleAt(a, observer) - visibleAt(b, observer) || a.sequence - b.sequence);
    const transition = visibleEvents.findLast(e => e.event_type === 'endpoint-state-changed');
    const projection = projectScenario(scenario, observer);
    const cells = Array.from({ length: fixture.grid.rows * fixture.grid.columns }, (_, i) => belief.cell({ row: Math.floor(i / fixture.grid.columns), column: i % fixture.grid.columns }));
    const significant = forObserver(observer).filter(e => !['received-belief-updated', 'observation-summarized'].includes(e.event_type) || informativeIds.has(e.payload.observation_id));
    const ticks = [0, ...significant.map(e => visibleAt(e, observer)), ...informative.map(time), maxTick];
    return {
      tick, observer, grid: clone(fixture.grid), cells,
      start: clone((projection.asset as ObjectValue).start_cell) as unknown as Cell,
      targets: clone(projection.target_entities),
      state: transition?.payload.to ?? 'idle', budget: clone(transition?.payload.budget_used ?? null),
      plan: clone(visibleEvents.findLast(e => e.event_type === 'plan-proposed')?.payload ?? null),
      events: visibleEvents.map(e => ({ event_id: e.event_id, event_type: e.event_type, occurred_tick: e.occurred_tick,
        received_tick: e.received_tick != null && e.received_tick <= tick ? e.received_tick : null, payload: clone(e.payload) })),
      observations: delivered.map((m): ObjectValue => ({ ...clone(m.payload), received_tick: m.deliver_at_tick <= tick ? m.deliver_at_tick : null })),
      belief_hash: belief.stateHash(),
      counts: { known: cells.filter(c => c.known).length, sensed: cells.filter(c => c.sensed).length, obstacles: cells.filter(c => c.obstacle).length },
      next_tick: ticks.filter(t => t > tick).sort((a, b) => a - b)[0] ?? null,
      previous_tick: ticks.filter(t => t < tick).sort((a, b) => b - a)[0] ?? null
    };
  }
  return { session: () => clone(session), view };
}

export type Archive = Awaited<ReturnType<typeof openArchive>>;
