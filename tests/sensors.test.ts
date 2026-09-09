import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { clone, type ObjectValue } from '@open-prospector/contracts';
import { createSensorAdapter, reflexWindow, type World } from '@open-prospector/simulation-world';

const scenario = JSON.parse(readFileSync('design/fixtures/vertical-slice/synthetic-v0.scenario.json', 'utf8'));
const metadata = { run_id: 'run:sensors', asset_id: 'asset:rover-v0', observation_id: 'observation:sensors', observed_tick: 10 };
const c = (row: number, column: number) => ({ row, column });
const world: World = { cell(row, column) { return { elevation_mm: 10 * row + 5 * column, obstacle: column === 45 && (row === 205 || row >= 207 && row <= 235), geofence: row <= 19 && column <= 19 }; } };
const footprints = (sample: { observation: ObjectValue }) => sample.observation.footprint_cells as unknown as { row: number; column: number }[];

test('sweep senses the complete clipped circle, including obstacle cells beyond the first', () => {
  const adapter = createSensorAdapter(world, scenario);
  const sample = adapter.sweep(c(220, 30), metadata);
  const expected = [];
  for (let row = 0; row < 256; row++) for (let column = 0; column < 256; column++) if ((row - 220) ** 2 + (column - 30) ** 2 <= 400) expected.push(c(row, column));
  assert.deepEqual(footprints(sample), expected);
  assert.equal(expected.length, 1257);
  assert.equal((sample.observation.belief_patch as unknown[]).length, expected.length);
  assert.equal(sample.discovered_hazards.length, 1);
  assert.equal(sample.discovered_hazards[0]!.cells.length, 27);
  assert.ok(!sample.discovered_hazards[0]!.cells.some(cell => cell.row === 235));
  const edge = adapter.sweep(c(0, 0), metadata);
  assert.ok(footprints(edge).every(cell => cell.row >= 0 && cell.column >= 0));
  assert.ok(footprints(edge).some(cell => cell.row === 20 && cell.column === 0));
  assert.ok(!footprints(edge).some(cell => cell.row === 20 && cell.column === 1));
});

test('runtime range samples complete centre-distance footprint and reports entry contact', () => {
  const adapter = createSensorAdapter(world, scenario);
  const path = [c(220, 43), c(220, 44), c(220, 45), c(220, 46), c(220, 47)];
  const sample = adapter.obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 0 }, path, metadata)!;
  assert.deepEqual(footprints(sample), [c(220, 44), c(220, 45), c(220, 46)]);
  assert.deepEqual(sample.contact, { cell: c(220, 45), distance_mm: 1500 });
  const mid = adapter.obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 900 }, path, metadata)!;
  assert.deepEqual(mid.contact, { cell: c(220, 45), distance_mm: 600 });
  assert.deepEqual(footprints(mid), footprints(sample));
  assert.equal((mid.observation.belief_patch as ObjectValue[]).length, 3);
});

test('diagonal sensor range uses 1414 mm edges and 707 mm boundary offsets', () => {
  const path = [c(207, 43), c(208, 44), c(209, 45), c(210, 46)];
  const sample = createSensorAdapter(world, scenario).obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 100 }, path, metadata)!;
  assert.deepEqual(footprints(sample), [c(208, 44), c(209, 45)]);
  assert.deepEqual(sample.contact, { cell: c(209, 45), distance_mm: 2021 });
});

test('range includes the 1 mm and 3000 mm centre boundaries and keeps later obstacles', () => {
  const path = [c(50, 50), c(50, 51), c(50, 52), c(50, 53), c(50, 54)];
  const adapter = createSensorAdapter({ cell() { return { elevation_mm: 0, obstacle: true, geofence: false }; } }, scenario);
  const exact = adapter.obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 0 }, path, metadata)!;
  assert.deepEqual(footprints(exact), path.slice(1, 4));
  assert.deepEqual(exact.contact, { cell: c(50, 51), distance_mm: 500 });
  assert.equal((exact.observation.belief_patch as ObjectValue[]).filter(patch => patch.obstacle).length, 3);
  const entered = adapter.obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 999 }, path, metadata)!;
  assert.deepEqual(footprints(entered), path.slice(1, 4));
  assert.deepEqual(entered.contact, { cell: c(50, 51), distance_mm: -499 });
});

test('hidden world and scenario mutations outside footprint cannot affect sensor result', () => {
  const changed = clone(scenario);
  changed.hazards[0].cells = [c(240, 240)];
  changed.hazards[0].hazard_id = 'hazard:mutated';
  changed.sensors.classifier_output.label = 'not-rock';
  const changedWorld: World = { cell(row, column) { return row > 200 ? { elevation_mm: -2000, obstacle: true, geofence: false } : world.cell(row, column); } };
  const base = createSensorAdapter(world, scenario).sweep(c(80, 80), metadata);
  const mutated = createSensorAdapter(changedWorld, changed).sweep(c(80, 80), metadata);
  assert.deepEqual(base, mutated);
  const visible = createSensorAdapter(world, scenario).sweep(c(220, 30), metadata);
  assert.notDeepEqual(visible, createSensorAdapter(world, changed).sweep(c(220, 30), metadata));
  assert.equal('classifier_output' in visible, false);
});

test('sensor retains no caller-owned scenario or returned metadata aliases', () => {
  const source = clone(scenario);
  const adapter = createSensorAdapter(world, source);
  const expected = adapter.sweep(c(220, 30), metadata);
  source.hazards[0].cells = [c(240, 240)];
  const returned = adapter.sweep(c(220, 30), metadata);
  returned.discovered_hazards[0]!.cells[0]!.row = 0;
  (returned.observation.belief_patch as ObjectValue[])[0]!.elevation_mm = 999;
  assert.deepEqual(adapter.sweep(c(220, 30), metadata), expected);
});

test('invalid route and metadata fail and clean samples contain no invented detection', () => {
  let reads = 0;
  const adapter = createSensorAdapter({ cell(row, column) { reads++; return world.cell(row, column); } }, scenario);
  const path = [c(50, 50), c(50, 51), c(50, 52), c(50, 53), c(50, 60)];
  assert.throws(() => adapter.obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 0 }, path, metadata));
  assert.equal(reads, 0);
  assert.throws(() => adapter.obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 1000 }, path.slice(0, 2), metadata));
  const clean = adapter.obstacleRange({ from_cell: path[0]!, to_cell: path[1]!, progress_mm: 0 }, path.slice(0, 2), metadata)!;
  assert.equal(clean.contact, null);
  assert.deepEqual(clean.discovered_hazards, []);
  assert.deepEqual(clean.observation.measurements, []);
  assert.throws(() => adapter.sweep(c(50, 50), { ...metadata, asset_id: 'asset:other' }), /identity/);
});

test('reflex arithmetic includes reaction, ceiling braking, and exact negotiation boundary', () => {
  assert.deepEqual(reflexWindow(2500, 100, 6000), { distance_mm: 2500, speed_mm_per_tick: 100, reaction_ticks: 1, braking_mm_per_tick_squared: 25, latency_ticks: 6000, stopping_distance_mm: 300, T: 22, window_open: false });
  assert.equal(reflexWindow(3300, 100, 7).window_open, true);
  assert.equal(reflexWindow(3099, 100, 7).window_open, false);
  assert.equal(reflexWindow(299, 100, 0).T, 0);
  assert.equal(reflexWindow(-500, 100, 1).T, 0);
  assert.equal(reflexWindow(100, 1, 1).stopping_distance_mm, 2);
  assert.equal(reflexWindow(100, 0, 25).window_open, true);
  assert.throws(() => reflexWindow(100, Number.MAX_SAFE_INTEGER, 1), /overflow/);
});
