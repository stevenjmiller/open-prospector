import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonical, clone, hash, hashBytes, validateFixture, type ObjectValue } from '@open-prospector/contracts';
import { loadAssetFixture, loadMissionFixture, observerLayers, projectScenario } from '@open-prospector/belief';
import { generateSynthetic } from '@open-prospector/simulation-world';
import { Channel } from '@open-prospector/channel';

const fixture = JSON.parse(readFileSync('design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json', 'utf8'));
const scenario = JSON.parse(readFileSync('design/fixtures/vertical-slice/synthetic-v0.scenario.json', 'utf8'));
const cell = { row: 220, column: 45 };
function setup() {
  const manifest = clone(fixture), layers = generateSynthetic(manifest);
  const read = (_root: string, layer: { name: string }) => layers.get(layer.name)!;
  return { manifest, layers, read, asset: loadAssetFixture('', manifest, 'run:test', 'asset:test', read), mission: loadMissionFixture('', manifest, 'run:test', 'asset:test', read) };
}
function observation(): ObjectValue {
  return { schema_version: 'observation-v0', observation_id: 'observation:test', run_id: 'run:test', asset_id: 'asset:test', sensor_id: 'sensor:test', observed_tick: 10, observation_type: 'obstacle-range', truth_contact: true, footprint_cells: [cell, { row: 219, column: 45 }], measurements: [], belief_patch: [{ cell, known: true, obstacle: true, elevation_mm: 2425, uncertainty_mm: 0 }] };
}

test('observer capability refuses truth and sibling scope before invoking storage', () => {
  const { manifest, read } = setup(); const opened: string[] = [];
  const load = observerLayers('', manifest, 'mission', (root, layer) => { opened.push(layer.name); return read(root, layer); });
  assert.throws(() => load('truth-elevation'), /scope/);
  assert.throws(() => load('asset-initial-elevation'), /scope/);
  assert.deepEqual(opened, []);
  manifest.layers[0].scope = 'mission-initial';
  assert.throws(() => observerLayers('', manifest, 'mission', read), /scope/);
});

test('mission can initialize with only five authorized files; hardlink aliases fail', () => {
  const { manifest, layers } = setup(); const root = mkdtempSync(join(tmpdir(), 'prospector-belief-'));
  for (const layer of validateFixture(manifest).layers.filter(l => l.scope === 'public' || l.scope === 'mission-initial')) writeFileSync(join(root, layer.path), layers.get(layer.name)!);
  assert.equal(loadMissionFixture(root, manifest, 'run:test', 'asset:test').cell(cell).obstacle, false);
  linkSync(join(root, 'mission-initial-known.u8'), join(root, 'alias.u8'));
  assert.throws(() => loadMissionFixture(root, manifest, 'run:test', 'asset:test'), /Linked/);
});

test('malformed metadata fails before reads: lengths, grid, missing, duplicate, scope, encoding, paths', () => {
  const mutations = [
    (m: any) => m.layers.pop(), (m: any) => m.layers.push(m.layers[0]),
    (m: any) => m.layers[0].byte_length--, (m: any) => m.grid.rows--,
    (m: any) => m.layers[0].scope = 'public', (m: any) => m.layers[0].encoding = 'uint8-bool',
    (m: any) => m.layers[0].hash = null, (m: any) => m.status = 'source-selected',
    ...['../truth.u8', 'C:truth.u8', '/truth.u8', 'dir\\truth.u8', 'CON.u8', 'x.', 'truth.u8:stream', 'TRUTH.u8'].map(path => (m: any) => m.layers[0].path = path),
    (m: any) => m.layers[3].path = m.layers[0].path
  ];
  for (const mutate of mutations) {
    const manifest = clone(fixture); mutate(manifest);
    let reads = 0;
    assert.throws(() => loadMissionFixture('', manifest, 'run:test', 'asset:test', () => { reads++; return Buffer.alloc(0); }));
    assert.equal(reads, 0);
  }
});

test('hash, byte count, boolean domain and initial elevation invariants are enforced', () => {
  for (const mode of ['hash', 'length', 'boolean', 'uncertainty', 'unknown']) {
    const { manifest, layers, read } = setup();
    const name = mode === 'uncertainty' ? 'mission-initial-uncertainty' : mode === 'unknown' ? 'mission-initial-known' : 'mission-initial-obstacles';
    let bytes = layers.get(name)!;
    if (mode === 'length') bytes = bytes.subarray(1);
    else bytes[0] = mode === 'boolean' ? 2 : mode === 'unknown' ? 0 : 1;
    if (mode === 'unknown') bytes[1] = 0; // nonzero elevation in unknown cell
    layers.set(name, bytes);
    if (mode !== 'hash' && mode !== 'length') manifest.layers.find((l: any) => l.name === name).hash = hashBytes(bytes);
    assert.throws(() => loadMissionFixture('', manifest, 'run:test', 'asset:test', read));
  }
});

test('truth mutations, source buffers and hidden scenario metadata do not alter observer inputs', () => {
  const { mission, asset, layers, manifest, read } = setup();
  const initial = mission.stateHash();
  assert.equal(mission.cell(cell).known, true); assert.equal(mission.cell(cell).obstacle, false);
  layers.get('truth-obstacles')!.fill(0);
  manifest.layers.find((l: any) => l.name === 'truth-obstacles').hash = hashBytes(layers.get('truth-obstacles')!);
  assert.equal(loadMissionFixture('', manifest, 'run:test', 'asset:test', read).stateHash(), initial);
  layers.get('mission-initial-elevation')!.fill(0);
  assert.equal(mission.stateHash(), initial); assert.equal(asset.stateHash(), initial);
  assert.throws(() => { (mission.cell(cell) as any).obstacle = true; });
  const changed = clone(scenario);
  changed.hazards[0].cells = [{ row: 1, column: 1 }];
  changed.hazards[0].hazard_id = 'hazard:changed';
  changed.target_entities.push({ ...changed.target_entities[0], entity_id: 'target:hidden', initially_known_to_asset: false, initially_known_to_mission: false });
  changed.sensors.classifier_output.confidence_ppm = 800000;
  for (const observer of ['mission', 'asset'] as const) {
    assert.equal(canonical(projectScenario(changed, observer)), canonical(projectScenario(scenario, observer)));
    assert.doesNotMatch(canonical(projectScenario(changed, observer)), /initially_known|classifier_output|source_hash|target:hidden/);
  }
});

test('asset observes immediately; mission changes only on delivered full observation', () => {
  const { asset, mission } = setup(); const initial = mission.stateHash(); const value = observation();
  asset.observe(value, 10);
  assert.equal(asset.cell(cell).obstacle, true); assert.equal(asset.cell({ row: 219, column: 45 }).sensed, true);
  assert.equal(mission.stateHash(), initial);
  const channel = new Channel('run:test', { one_way_latency_ticks: 3000, tier1_bytes_per_tick: 4096, tier2_bytes_per_tick: 100 }, 0);
  const summary = channel.enqueue({ direction: 'asset-to-mission', tier: 'tier-1', priority: 180, sent_tick: 10, payload_kind: 'observation-summary', payload: { observation_id: value.observation_id!, observation_type: value.observation_type!, observed_tick: 10, footprint_hash: hash(value.footprint_cells), changed_cell_count: 1, hazard_cells: [cell], artifact_refs: [] } });
  const message = channel.enqueue({ direction: 'asset-to-mission', tier: 'tier-2', priority: 160, sent_tick: 10, payload_kind: 'observation', payload: value });
  assert.throws(() => mission.receive(message, message.deliver_at_tick - 1));
  assert.equal(mission.stateHash(), initial);
  for (const delivered of channel.deliver(summary.deliver_at_tick)) mission.receive(delivered, summary.deliver_at_tick);
  assert.equal(mission.stateHash(), initial);
  for (const delivered of channel.deliver(message.deliver_at_tick)) mission.receive(delivered, message.deliver_at_tick);
  assert.equal(mission.stateHash(), asset.stateHash());
  assert.throws(() => mission.receive(message, message.deliver_at_tick), /Duplicate/);
});

test('invalid observation leaves all cells and sensed mask unchanged', () => {
  const mutations = [
    (o: any) => o.belief_patch.push({ ...o.belief_patch[0], cell: { row: 219, column: 45 }, elevation_mm: 2147483648 }),
    (o: any) => o.belief_patch[0].uncertainty_mm = 4294967296,
    (o: any) => o.belief_patch.push(o.belief_patch[0]),
    (o: any) => o.belief_patch[0].cell = { row: 1, column: 1 },
    (o: any) => o.run_id = 'run:other', (o: any) => o.asset_id = 'asset:other',
    (o: any) => o.observed_tick = 9
  ];
  for (const mutate of mutations) { const { asset } = setup(); const initial = asset.stateHash(); const value = observation(); mutate(value); assert.throws(() => asset.observe(value, 10)); assert.equal(asset.stateHash(), initial); asset.observe(observation(), 10); }
});

test('mission rejects impossible chronology and backward deliveries atomically', () => {
  const { mission } = setup(); const initial = mission.stateHash();
  const channel = new Channel('run:test', { one_way_latency_ticks: 30, tier1_bytes_per_tick: 4096, tier2_bytes_per_tick: 1024 }, 0);
  const message = channel.enqueue({ direction: 'asset-to-mission', tier: 'tier-2', priority: 160, sent_tick: 10, payload_kind: 'observation', payload: observation() });
  assert.throws(() => mission.receive({ ...message, sent_tick: 9 }, message.deliver_at_tick));
  assert.throws(() => mission.receive({ ...message, sent_tick: 100 }, message.deliver_at_tick));
  assert.throws(() => mission.receive(message, message.deliver_at_tick + 1));
  assert.equal(mission.stateHash(), initial);
  mission.receive(message, message.deliver_at_tick);
  const after = mission.stateHash();
  assert.throws(() => mission.receive({ ...message, deliver_at_tick: message.deliver_at_tick - 1 }, message.deliver_at_tick - 1));
  assert.equal(mission.stateHash(), after);
});
