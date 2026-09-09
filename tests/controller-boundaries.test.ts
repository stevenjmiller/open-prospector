import assert from 'node:assert/strict';
import test from 'node:test';
import { clone, hash, type ObjectValue } from '@open-prospector/contracts';
import { buildAcceptedRevision } from '@open-prospector/belief';
import { createFixture, drive, directive, scenario } from './controller-fixture.js';

function nearTarget() {
  const original = clone(directive), world = clone(scenario);
  world.asset.start_cell = { row: 180, column: 70 };
  original.observation_cell = { row: 180, column: 70 };
  delete original.advisory_route;
  return { directive: original, scenario: world, latency: 0 };
}

test('controller rejects out-of-footprint hazard metadata before any belief mutation', () => {
  const context = createFixture({ latency: 0, wrap: sensors => ({ ...sensors, sweep(cell, metadata) {
    const sample = sensors.sweep(cell, metadata);
    sample.discovered_hazards.push({ hazard_id: 'hazard:outside-sample', kind: 'rock', policy_class: 'reflex-if-closed', cells: [{ row: 0, column: 0 }] });
    return sample;
  } }) });
  const before = context.belief.stateHash();
  const result = drive(context, { maxTick: 2 });
  assert.equal(result.checkpoint.state, 'faulted');
  assert.equal(context.belief.stateHash(), before);
  assert.equal(result.intents.some(intent => intent.payload_kind === 'observation'), false);
});

test('controller summary canonicalizes footprint order and chooses first sixteen sorted hazard cells', () => {
  const context = createFixture({ latency: 0, wrap: sensors => ({ ...sensors, sweep(cell, metadata) {
    const sample = sensors.sweep(cell, metadata);
    (sample.observation.footprint_cells as ObjectValue[]).reverse();
    (sample.observation.belief_patch as ObjectValue[]).reverse();
    return sample;
  } }) });
  const result = drive(context, { maxTick: 1, accept: false });
  assert.equal(result.checkpoint.state, 'holding');
  const summary = result.intents.find(intent => intent.payload_kind === 'observation-summary')!.payload;
  const observation = result.intents.find(intent => intent.payload_kind === 'observation')!.payload;
  const order = (a: ObjectValue, b: ObjectValue) => Number(a.row) - Number(b.row) || Number(a.column) - Number(b.column);
  const footprint = [...observation.footprint_cells as ObjectValue[]].sort(order);
  const hazards = (observation.belief_patch as ObjectValue[]).filter(patch => patch.obstacle).map(patch => patch.cell as ObjectValue).sort(order);
  assert.ok(hazards.length > 16);
  assert.equal(summary.footprint_hash, hash(footprint));
  assert.deepEqual(summary.hazard_cells, hazards.slice(0, 16));
});

test('actual controller faults on tampered accepted revision and retains original directive and budget', () => {
  const context = createFixture({ latency: 0 });
  const first = context.controller.advance(1, context.channel.deliver(1));
  const offer = first.find(intent => intent.payload_kind === 'contestation')!.payload;
  assert.equal(context.controller.state, 'holding');
  const alternative = (offer.alternatives as ObjectValue[])[0]!;
  const revision = buildAcceptedRevision(context.original, alternative, { contestation_id: offer.contestation_id!, alternative_id: alternative.alternative_id!, accepted_by: context.original.author_id!, accepted_tick: 1 }, 'directive:tampered');
  revision.observation_cell = { row: 180, column: 71 };
  context.channel.enqueue({ direction: 'mission-to-asset', tier: 'tier-1', priority: 220, sent_tick: 1, payload_kind: 'directive-revision', payload: revision });
  const emitted = context.controller.advance(2, context.channel.deliver(2));
  assert.equal(context.controller.state, 'faulted');
  assert.equal((context.controller.checkpoint().directive as ObjectValue).directive_id, context.original.directive_id);
  assert.equal((context.controller.checkpoint().budget as ObjectValue).revision, 0);
  assert.equal(emitted.some(intent => intent.payload_kind === 'contestation'), false);
});

test('actual controller refuses a cleared directive intersecting public no-go without contestation', () => {
  const original = clone(directive);
  original.target = { kind: 'cell', cell: { row: 0, column: 0 } };
  const result = drive(createFixture({ directive: original, latency: 0 }), { maxTick: 2 });
  assert.equal(result.checkpoint.state, 'faulted');
  assert.equal(result.intents.some(intent => intent.payload_kind === 'contestation'), false);
  assert.equal(result.checkpoint.directive, null);
});

test('controller completes the valid near-target fixture used by final-evidence boundary cases', () => {
  const result = drive(createFixture(nearTarget()), { maxTick: 3 });
  assert.equal(result.checkpoint.state, 'completed');
});

for (const variant of ['wrong-type', 'duplicate-measurement', 'occupied-patch'] as const) {
  test(`controller cannot complete with final standoff ${variant}`, () => {
    const context = createFixture({ ...nearTarget(), wrap: sensors => ({ ...sensors, standoff(cell, target, metadata) {
      const observation = sensors.standoff(cell, target, metadata);
      if (variant === 'wrong-type') observation.observation_type = 'local-sweep';
      if (variant === 'duplicate-measurement') (observation.measurements as ObjectValue[]).unshift({ name: 'line_of_sight', value: false, unit: 'boolean', uncertainty_ppm: 0 });
      if (variant === 'occupied-patch') observation.belief_patch = [{ cell: { ...cell }, known: true, obstacle: true, elevation_mm: 2150, uncertainty_mm: 0 }];
      return observation;
    } }) });
    const result = drive(context, { maxTick: 3 });
    assert.equal(result.checkpoint.state, 'faulted');
    assert.equal(result.transitions.some(transition => transition.to === 'completed'), false);
    assert.equal(result.intents.some(intent => intent.payload_kind === 'science-artifact'), false);
  });
}
