import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { type FixtureManifest } from '@open-prospector/contracts';
import { generateSynthetic, loadWorld, materializeSynthetic } from '@open-prospector/simulation-world';

function manifest(): FixtureManifest {
  return JSON.parse(readFileSync(new URL('../../design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json', import.meta.url), 'utf8')) as FixtureManifest;
}
function destination(): string { return join(mkdtempSync(join(tmpdir(), 'op-synthetic-')), 'rasters'); }
const digest = (bytes: Uint8Array) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

test('synthetic generator matches every authored frozen hash and independent cell vectors', () => {
  const input = manifest();
  const layers = generateSynthetic(input);
  assert.equal(layers.size, 11);
  for (const layer of input.layers) {
    const bytes = layers.get(layer.name)!;
    assert.equal(bytes.length, layer.byte_length);
    assert.equal(digest(bytes), layer.hash);
  }
  const elevation = layers.get('truth-elevation')!;
  assert.equal(elevation.readInt32LE(0), 0);
  assert.equal(elevation.readInt32LE(4), 5);
  assert.equal(elevation.readInt32LE(256 * 4), 10);
  assert.equal(elevation.readInt32LE(65535 * 4), 3825);
  const obstacles = layers.get('truth-obstacles')!;
  assert.equal(obstacles.reduce((a, b) => a + b, 0), 30);
  for (const row of [205, 207, 220, 235]) assert.equal(obstacles[row * 256 + 45], 1);
  for (const row of [204, 206, 236]) assert.equal(obstacles[row * 256 + 45], 0);
  assert.equal(obstacles[220 * 256 + 44], 0);
  assert.equal(obstacles[220 * 256 + 46], 0);
  const fence = layers.get('geofence')!;
  assert.equal(fence.reduce((a, b) => a + b, 0), 400);
  assert.equal(fence[19 * 256 + 19], 1);
  assert.equal(fence[20 * 256 + 19], 0);
  assert.equal(fence[19 * 256 + 20], 0);
  for (const observer of ['asset', 'mission']) {
    assert.equal(layers.get(`${observer}-initial-known`)!.every(value => value === 1), true);
    assert.equal(layers.get(`${observer}-initial-obstacles`)!.every(value => value === 0), true);
    assert.equal(layers.get(`${observer}-initial-uncertainty`)!.every(value => value === 0), true);
  }
  layers.get('asset-initial-elevation')!.fill(0);
  assert.equal(elevation.readInt32LE(4), 5);
  assert.equal(layers.get('mission-initial-elevation')!.readInt32LE(4), 5);
});

test('generator rejects changed source identity or layer hash before creating files', () => {
  const source = manifest();
  source.source.source_hash = 'sha256:' + '0'.repeat(64);
  assert.throws(() => generateSynthetic(source), /identity/);
  const bad = manifest();
  bad.layers[bad.layers.length - 1]!.hash = 'sha256:' + '0'.repeat(64);
  const root = destination();
  assert.throws(() => materializeSynthetic(root, bad), /integrity/);
  assert.equal(existsSync(root), false);
});

test('materialization writes frozen bytes and refuses to overwrite an existing destination', () => {
  const input = manifest(), root = destination();
  materializeSynthetic(root, input);
  for (const layer of input.layers) assert.equal(digest(readFileSync(join(root, layer.path))), layer.hash);
  writeFileSync(join(root, 'sentinel'), 'keep');
  assert.throws(() => materializeSynthetic(root, input), /EEXIST/);
  assert.equal(readFileSync(join(root, 'sentinel'), 'utf8'), 'keep');
  for (const layer of input.layers) assert.equal(digest(readFileSync(join(root, layer.path))), layer.hash);
});

test('world loads only truth/public files and keeps immutable snapshots independent of caller and disk mutation', () => {
  const input = manifest(), root = destination(), layers = generateSynthetic(input);
  mkdirSync(root);
  for (const layer of input.layers.filter(v => v.scope === 'truth' || v.scope === 'public')) writeFileSync(join(root, layer.path), layers.get(layer.name)!);
  const world = loadWorld(root, input);
  assert.deepEqual(Object.keys(world), ['cell']);
  const sample = world.cell(220, 45);
  assert.deepEqual(sample, { elevation_mm: 2425, obstacle: true, geofence: false });
  assert.equal(Object.isFrozen(sample), true);
  assert.equal(Object.isFrozen(world), true);
  assert.notEqual(sample, world.cell(220, 45));
  assert.deepEqual(world.cell(19, 19), { elevation_mm: 285, obstacle: false, geofence: true });
  for (const [row, column] of [[-1, 0], [256, 0], [0, 256], [1.5, 1], [NaN, 0], [0, Infinity]]) {
    assert.throws(() => world.cell(row!, column!), /outside grid/);
  }
  input.grid.rows = 1;
  layers.get('truth-elevation')!.fill(0);
  writeFileSync(join(root, 'truth-elevation.i32le'), layers.get('truth-elevation')!);
  assert.deepEqual(world.cell(220, 45), sample);
  assert.throws(() => loadWorld(root, manifest()), /integrity/);
});
