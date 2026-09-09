import { lstatSync, openSync, closeSync, fstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { clone, hashBytes, validate } from './index.js';

export interface RasterLayer { name: string; scope: string; path: string; encoding: string; byte_length: number; hash: string }
export interface FixtureManifest {
  fixture_id: string; status: string;
  grid: { rows: number; columns: number; cell_size_mm: number };
  source: { source_hash: string; product_id: string };
  layers: RasterLayer[];
}

/** Runtime materialization checks in addition to the authoring schema. */
export function validateFixture(input: unknown): FixtureManifest {
  validate('fixture-manifest', input);
  const manifest = clone(input) as FixtureManifest;
  if (manifest.status === 'source-selected' || !manifest.source.source_hash) throw new Error('Fixture is not materialized');
  const expected = new Map<string, [string, string]>();
  expected.set('truth-elevation', ['truth', 'int32-le-mm']);
  expected.set('truth-obstacles', ['truth', 'uint8-bool']);
  expected.set('geofence', ['public', 'uint8-bool']);
  for (const scope of ['asset-initial', 'mission-initial']) {
    for (const [suffix, encoding] of [['elevation', 'int32-le-mm'], ['obstacles', 'uint8-bool'], ['known', 'uint8-bool'], ['uncertainty', 'uint32-le-mm']] as const) expected.set(`${scope}-${suffix}`, [scope, encoding]);
  }
  const paths = new Set<string>();
  for (const layer of manifest.layers) {
    const pair = expected.get(layer.name);
    if (!pair || layer.scope !== pair[0] || layer.encoding !== pair[1]) throw new Error('Invalid layer name/scope/encoding');
    expected.delete(layer.name);
    // Portable flat fixture directories: no traversal, Windows aliases, ADS, or case aliases.
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(layer.path) || layer.path.endsWith('.') || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/.test(layer.path) || paths.has(layer.path)) throw new Error('Invalid or aliased raster path');
    paths.add(layer.path);
    if (!layer.hash || layer.byte_length !== manifest.grid.rows * manifest.grid.columns * (layer.encoding === 'uint8-bool' ? 1 : 4)) throw new Error('Invalid raster length/hash');
  }
  if (expected.size) throw new Error('Missing fixture layers');
  return manifest;
}

export function validateRaster(layer: RasterLayer, bytes: Uint8Array): Buffer {
  if (bytes.length !== layer.byte_length || hashBytes(bytes) !== layer.hash) throw new Error('Raster integrity mismatch');
  if (layer.encoding === 'uint8-bool' && bytes.some(value => value > 1)) throw new Error('Invalid boolean raster');
  return Buffer.from(bytes);
}

/** Privileged filesystem utility, not an observer capability. Callers must authorize scope first. */
export function readRasterFile(root: string, layer: RasterLayer): Buffer {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(layer.path) || layer.path.endsWith('.')) throw new Error('Invalid raster path');
  const directory = resolve(root);
  if (lstatSync(directory).isSymbolicLink() || realpathSync(directory).toLowerCase() !== directory.toLowerCase()) throw new Error('Linked fixture directory');
  const path = join(directory, layer.path);
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new Error('Linked or non-file raster');
  const fd = openSync(path, 'r');
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1 || opened.size !== layer.byte_length) throw new Error('Raster file changed or has invalid length');
    return validateRaster(layer, readFileSync(fd));
  } finally { closeSync(fd); }
}
