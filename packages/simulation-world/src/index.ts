import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export { createSensorAdapter, reflexWindow } from './sensors.js';
export type { ObservationMetadata, MotionPose, VisibleHazard, SensorSample } from './sensors.js';
import {
  hashBytes, validateFixture, validateRaster, readRasterFile
} from '@open-prospector/contracts';

const formula = 'synthetic-v0-formula-1\n'
  + 'elevation_mm=10*row+5*column\n'
  + 'truth_obstacles=column45,row207..235;row205,column45\n'
  + 'geofence=rows0..19,columns0..19\n'
  + 'initial_known=all\n'
  + 'initial_obstacles=none\n'
  + 'initial_uncertainty_mm=0\n';

/** Generate independent layer buffers keyed by manifest layer name. Every byte
 * is checked against the supplied frozen manifest before any output is written. */
export function generateSynthetic(input: unknown): Map<string, Buffer> {
  const manifest = validateFixture(input);
  const identity = manifest as unknown as {
    status: string; fixture_id: string;
    source: { kind: string; product_id: string; source_hash: string };
  };
  if (identity.status !== 'synthetic' || identity.fixture_id !== 'fixture:synthetic-v0'
    || identity.source.kind !== 'synthetic-formula'
    || identity.source.product_id !== 'synthetic-v0-formula-1'
    || identity.source.source_hash !== hashBytes(Buffer.from(formula, 'utf8'))) {
    throw new Error('Synthetic v0 generator identity mismatch');
  }
  const cells = 256 * 256;
  const elevation = Buffer.alloc(cells * 4);
  const obstacles = Buffer.alloc(cells);
  const geofence = Buffer.alloc(cells);
  for (let row = 0; row < 256; row++) {
    for (let column = 0; column < 256; column++) {
      const index = row * 256 + column;
      elevation.writeInt32LE(10 * row + 5 * column, index * 4);
      obstacles[index] = Number(column === 45 && (row === 205 || (row >= 207 && row <= 235)));
      geofence[index] = Number(row <= 19 && column <= 19);
    }
  }
  const layers = new Map<string, Buffer>();
  for (const layer of manifest.layers) {
    let bytes: Buffer;
    if (layer.name.endsWith('-elevation')) bytes = Buffer.from(elevation);
    else if (layer.name === 'truth-obstacles') bytes = Buffer.from(obstacles);
    else if (layer.name === 'geofence') bytes = Buffer.from(geofence);
    else if (layer.name.endsWith('-known')) bytes = Buffer.alloc(cells, 1);
    else if (layer.name.endsWith('-obstacles')) bytes = Buffer.alloc(cells);
    else if (layer.name.endsWith('-uncertainty')) bytes = Buffer.alloc(cells * 4);
    else throw new Error('Unsupported synthetic layer: ' + layer.name);
    layers.set(layer.name, Buffer.from(validateRaster(layer, bytes)));
  }
  return layers;
}

/** Destination must not exist. Validation finishes before the directory is
 * created; a failed write preserves partial evidence and never overwrites it. */
export function materializeSynthetic(root: string, input: unknown): void {
  const manifest = validateFixture(input);
  const layers = generateSynthetic(input);
  mkdirSync(root);
  for (const layer of manifest.layers) {
    writeFileSync(join(root, layer.path), layers.get(layer.name)!, { flag: 'wx' });
  }
}

export interface WorldCell {
  readonly elevation_mm: number;
  readonly obstacle: boolean;
  readonly geofence: boolean;
}
export interface World {
  cell(row: number, column: number): Readonly<WorldCell>;
}

/** Privileged simulator boundary. Mutable raster buffers remain closure-private;
 * callers receive fresh frozen scalar samples, never the manifest or metadata. */
export function loadWorld(root: string, input: unknown): World {
  const manifest = validateFixture(input);
  const load = (name: string): Buffer => {
    const layer = manifest.layers.find(candidate => candidate.name === name);
    if (!layer) throw new Error('Missing world layer: ' + name);
    return Buffer.from(validateRaster(layer, readRasterFile(root, layer)));
  };
  const elevation = load('truth-elevation');
  const obstacles = load('truth-obstacles');
  const geofence = load('geofence');
  return Object.freeze({
    cell(row: number, column: number): Readonly<WorldCell> {
      if (!Number.isInteger(row) || !Number.isInteger(column)
        || row < 0 || row >= 256 || column < 0 || column >= 256) {
        throw new Error('World cell outside grid');
      }
      const index = row * 256 + column;
      return Object.freeze({
        elevation_mm: elevation.readInt32LE(index * 4),
        obstacle: obstacles[index] === 1,
        geofence: geofence[index] === 1
      });
    }
  });
}
