import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonical, clone, validateFixture, validateRaster, type RasterLayer } from '@open-prospector/contracts';
import { loadWorld } from '@open-prospector/simulation-world';
import { loadAssetFixture, loadMissionFixture, observerLayers } from '@open-prospector/belief';
import { Channel } from '@open-prospector/channel';

// An explicit override permits reviewing candidate bytes without approving a crop.
const root = process.env.CANDOR_FIXTURE_DIR ?? 'fixtures/candor-sw-v0';
const digest = (bytes: Uint8Array) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const read = (name: string) => readFileSync(join(root, name));
const manifest = () => JSON.parse(read('fixture-manifest.json').toString('utf8'));
const halfAway = (metres: number) => metres < 0 ? -Math.floor(-metres * 1000 + 0.5) : Math.floor(metres * 1000 + 0.5);

test('Candor preparation binds source window, label, tools and all eleven layers', () => {
  const input = manifest();
  const validated = validateFixture(input);
  assert.equal(validated.status, 'materialized');
  assert.equal(validated.fixture_id, 'fixture:candor-sw-v0');
  assert.equal(validated.layers.length, 11);
  const metadataBytes = read(input.preparation.path);
  assert.equal(metadataBytes.at(-1), 10);
  assert.equal(digest(metadataBytes), input.preparation.hash); // Includes the trailing LF.
  const provenance = JSON.parse(metadataBytes.toString('utf8'));
  assert.equal(provenance.profile, 'candor-preparation-v0');
  assert.equal(provenance.source_hash, input.source.source_hash);
  assert.equal(provenance.source_label_hash, digest(read('source-label.txt')));
  assert.equal(provenance.source_window_hash, digest(read('source-window.f32le')));
  assert.equal(provenance.source_row, input.crop.source_row);
  assert.equal(provenance.source_column, input.crop.source_column);
  assert.deepEqual(provenance.source_shape, [10767, 6368]);
  assert.equal(provenance.source_bytes, 274282496);
  assert.ok(input.crop.source_row >= 0 && input.crop.source_row + 256 <= provenance.source_shape[0]);
  assert.ok(input.crop.source_column >= 0 && input.crop.source_column + 256 <= provenance.source_shape[1]);
  assert.equal(input.source.source_scale_mm_per_pixel, halfAway(Number(provenance.source_scale_metres)));
  assert.equal(input.crop.rounding, 'half-away-from-zero-to-mm');
  assert.equal(input.crop.resampler, 'nearest-pixel-1to1');
  assert.equal(input.local_frame.datum_elevation_mm, 0);
  assert.equal(provenance.rounding, input.crop.rounding);
  assert.equal(provenance.resampler, input.crop.resampler);
  assert.match(provenance.source_crs_wkt, /EQUIRECTANGULAR MARS/);
  const [a, b, , d, e] = provenance.source_affine.map(Number);
  assert.ok(a > 0 && e < 0);
  assert.equal(b, 0); assert.equal(d, 0);
  assert.equal(a, Number(provenance.source_scale_metres));
  assert.equal(-e, a);
  assert.match(read('source-label.txt').toString('ascii'), /NORTH_AZIMUTH\s*=\s*270\.000000/);
  assert.equal(provenance.script_hash, digest(read('ingest-script.py')));
  const reviewBytes = read('review.json');
  assert.equal(provenance.review_hash, digest(reviewBytes));
  const review = JSON.parse(reviewBytes.toString('utf8'));
  assert.equal(review.decision, 'approved');
  assert.equal(review.source_hash, provenance.source_hash);
  assert.equal(review.source_row, input.crop.source_row);
  assert.equal(review.source_column, input.crop.source_column);
  for (const version of ['python_version', 'numpy_version', 'rasterio_version', 'gdal_version']) assert.match(provenance[version], /^\d+\.\d+/);
  const binaries = Object.entries(provenance.tool_binaries);
  assert.ok(binaries.some(([name]) => /gdal/i.test(name)));
  assert.ok(binaries.some(([name]) => /^_io\./.test(name)));
  for (const [name, hash] of binaries) {
    assert.match(name, /^[^/\\]+$/);
    assert.match(String(hash), /^sha256:[a-f0-9]{64}$/);
    assert.notEqual(hash, 'sha256:' + '0'.repeat(64));
  }
  assert.equal(Object.keys(provenance.layer_hashes).length, 11);
  for (const layer of validated.layers) {
    const bytes = read(layer.path);
    assert.equal(bytes.length, layer.byte_length);
    assert.equal(digest(bytes), layer.hash);
    assert.equal(provenance.layer_hashes[layer.name], layer.hash);
    assert.deepEqual(validateRaster(layer, bytes), bytes);
  }
});

test('Candor row-major elevations independently round every source float32 sample without flips or transposition', () => {
  const input = manifest();
  const source = read('source-window.f32le');
  assert.equal(source.length, 256 * 256 * 4);
  const elevation = read(input.layers.find((layer: RasterLayer) => layer.name === 'truth-elevation').path);
  const world = loadWorld(root, input);
  assert.deepEqual([halfAway(0.0005), halfAway(-0.0005), halfAway(0.0015), halfAway(-0.0015)], [1, -1, 2, -2]);
  for (let index = 0; index < 65536; index++) {
    const metres = source.readFloatLE(index * 4);
    assert.ok(Number.isFinite(metres) && metres >= 782.07 && metres <= 1300.01);
    assert.equal(elevation.readInt32LE(index * 4), halfAway(metres), `source pixel ${index}`);
  }
  for (const [row, column] of [[0, 0], [0, 1], [1, 0], [0, 255], [255, 0], [255, 255], [220, 45]]) {
    const index = row! * 256 + column!;
    assert.equal(world.cell(row!, column!).elevation_mm, halfAway(source.readFloatLE(index * 4)));
  }
  assert.equal(world.cell(220, 45).obstacle, true);
  assert.equal(world.cell(206, 45).obstacle, false);
  assert.equal(world.cell(19, 19).geofence, true);
  assert.equal(world.cell(20, 19).geofence, false);
  for (const observer of ['asset', 'mission'] as const) {
    const belief = observer === 'asset' ? loadAssetFixture(root, input, 'run:candor-test', 'asset:test') : loadMissionFixture(root, input, 'run:candor-test', 'asset:test');
    for (let index = 0; index < 65536; index++) {
      const cell = belief.cell({ row: Math.floor(index / 256), column: index % 256 });
      assert.equal(cell.elevation_mm, elevation.readInt32LE(index * 4));
      assert.equal(cell.known, true); assert.equal(cell.uncertainty_mm, 0);
      assert.equal(cell.obstacle, false); assert.equal(cell.sensed, false);
    }
  }
});

test('materialized Candor rejects incomplete provenance and invalid raster declarations before storage', () => {
  const mutations = [
    (m: any) => { m.crop.source_row = null; }, (m: any) => { m.crop.source_column = null; },
    (m: any) => { m.source.source_hash = null; }, (m: any) => { delete m.preparation; },
    (m: any) => { m.preparation.hash = null; }, (m: any) => { m.layers[0].hash = null; },
    (m: any) => { m.layers[0].scope = 'mission-initial'; }, (m: any) => { m.layers.pop(); },
    (m: any) => { m.layers.push(clone(m.layers[0])); }, (m: any) => { m.grid.rows = 255; },
    (m: any) => { m.layers[0].byte_length--; }
  ];
  for (const mutate of mutations) {
    const input = manifest(); mutate(input);
    assert.throws(() => validateFixture(input));
    let reads = 0;
    assert.throws(() => loadMissionFixture('', input, 'run:candor-test', 'asset:test', () => { reads++; return Buffer.alloc(0); }));
    assert.equal(reads, 0);
  }
});

test('Candor observer loaders need only five authorized files and deny truth before reading', () => {
  const input = manifest();
  for (const observer of ['asset', 'mission'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `op-candor-${observer}-`));
    const allowed = input.layers.filter((layer: RasterLayer) => layer.scope === `${observer}-initial` || layer.scope === 'public');
    assert.equal(allowed.length, 5);
    for (const layer of allowed) copyFileSync(join(root, layer.path), join(directory, layer.path));
    const loader = observer === 'asset' ? loadAssetFixture : loadMissionFixture;
    assert.equal(loader(directory, input, 'run:candor-test', 'asset:test').stateHash(), loader(root, input, 'run:candor-test', 'asset:test').stateHash());
    let reads = 0;
    const capability = observerLayers(directory, input, observer, () => { reads++; throw new Error('Storage must not be called'); });
    for (const name of ['truth-elevation', 'truth-obstacles', `${observer === 'asset' ? 'mission' : 'asset'}-initial-elevation`]) assert.throws(() => capability(name), /scope denied/);
    assert.equal(reads, 0);
  }
});

test('changing hidden Candor truth leaves both initial observer states unchanged', () => {
  const input = manifest();
  const bytes = new Map<string, Buffer>(input.layers.map((layer: RasterLayer) => [layer.name, read(layer.path)]));
  const reader = (_directory: string, layer: RasterLayer) => bytes.get(layer.name)!;
  const asset = loadAssetFixture('', input, 'run:candor-test', 'asset:test', reader);
  const mission = loadMissionFixture('', input, 'run:candor-test', 'asset:test', reader);
  for (const layer of input.layers.filter((value: RasterLayer) => value.scope === 'truth')) {
    bytes.get(layer.name)!.fill(0);
    layer.hash = digest(bytes.get(layer.name)!);
  }
  assert.equal(loadAssetFixture('', input, 'run:candor-test', 'asset:test', reader).stateHash(), asset.stateHash());
  assert.equal(loadMissionFixture('', input, 'run:candor-test', 'asset:test', reader).stateHash(), mission.stateHash());
  assert.equal(asset.cell({ row: 220, column: 45 }).obstacle, false);
  assert.equal(mission.cell({ row: 220, column: 45 }).obstacle, false);
});

test('Candor evidence updates asset immediately and mission only after full observation delivery', () => {
  const input = manifest(), cell = { row: 220, column: 45 };
  const world = loadWorld(root, input);
  const asset = loadAssetFixture(root, input, 'run:candor-test', 'asset:test');
  const mission = loadMissionFixture(root, input, 'run:candor-test', 'asset:test');
  const initial = mission.stateHash();
  const observation = { schema_version: 'observation-v0', observation_id: 'observation:candor-test', run_id: 'run:candor-test', asset_id: 'asset:test', sensor_id: 'sensor:test', observed_tick: 10, observation_type: 'obstacle-range', truth_contact: true, footprint_cells: [cell], measurements: [], belief_patch: [{ cell, known: true, obstacle: world.cell(cell.row, cell.column).obstacle, elevation_mm: world.cell(cell.row, cell.column).elevation_mm, uncertainty_mm: 0 }] };
  asset.observe(observation, 10);
  assert.equal(asset.cell(cell).obstacle, true);
  assert.equal(asset.cell(cell).sensed, true);
  assert.equal(mission.stateHash(), initial);
  const channel = new Channel('run:candor-test', { one_way_latency_ticks: 3000, tier1_bytes_per_tick: 4096, tier2_bytes_per_tick: 100 }, 0);
  const message = channel.enqueue({ direction: 'asset-to-mission', tier: 'tier-2', priority: 160, sent_tick: 10, payload_kind: 'observation', payload: observation });
  assert.throws(() => mission.receive(message, message.deliver_at_tick - 1));
  assert.equal(mission.stateHash(), initial);
  assert.deepEqual(channel.deliver(message.deliver_at_tick - 1), []);
  for (const delivered of channel.deliver(message.deliver_at_tick)) mission.receive(delivered, message.deliver_at_tick);
  assert.equal(mission.stateHash(), asset.stateHash());
  assert.equal(mission.cell(cell).sensed, true);
});

test('Candor verification rejects damaged sidecars and a rehashed review for a different crop', () => {
  const verify = (directory: string) => spawnSync(process.execPath, ['scripts/verify-candor.mjs', directory], { encoding: 'utf8' });
  const clean = verify(root);
  assert.equal(clean.status, 0, clean.stderr);
  for (const mode of ['damaged-sidecar', 'wrong-reviewed-crop']) {
    const directory = join(mkdtempSync(join(tmpdir(), 'op-candor-corrupt-')), 'fixture');
    cpSync(root, directory, { recursive: true });
    if (mode === 'damaged-sidecar') {
      writeFileSync(join(directory, 'source-label.txt'), 'changed source label');
    } else {
      const input = manifest();
      const preparation = JSON.parse(read('preparation.json').toString('utf8'));
      const review = JSON.parse(read('review.json').toString('utf8'));
      review.source_row++;
      const reviewBytes = Buffer.from(canonical(review) + '\n');
      preparation.review_hash = digest(reviewBytes);
      const preparationBytes = Buffer.from(canonical(preparation) + '\n');
      input.preparation.hash = digest(preparationBytes);
      writeFileSync(join(directory, 'review.json'), reviewBytes);
      writeFileSync(join(directory, 'preparation.json'), preparationBytes);
      writeFileSync(join(directory, 'fixture-manifest.json'), canonical(input) + '\n');
    }
    const result = verify(directory);
    assert.equal(result.status, 1, `${mode}: ${result.stdout} ${result.stderr}`);
    assert.match(result.stderr, /AssertionError/);
  }
});
