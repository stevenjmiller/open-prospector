import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LineageBudget, BudgetExceeded, ReserveExceeded, EdgeMotion } from '@open-prospector/autonomy';
import { canonical, clone, type ObjectValue } from '@open-prospector/contracts';

function directive(overrides: ObjectValue = {}): ObjectValue {
  return { ...JSON.parse(readFileSync(new URL('../../fixtures/spine-v0/directive.json', import.meta.url), 'utf8')) as ObjectValue, ...overrides };
}
function limits(duration_ticks = 100, traverse_mm = 10000, energy_units = 1000, tier2_bytes = 10000) {
  return { duration_ticks, traverse_mm, energy_units, tier2_bytes };
}
function budget(overrides: ObjectValue = {}, start = 0, energy = 10000) {
  return new LineageBudget(directive({ budget: limits(), ...overrides }), start, energy);
}

test('budget checks time equality before work, counts transit/holds, and freezes failed usage', () => {
  const ledger = budget({ budget: limits(10) }, 3);
  ledger.debit(12, { traverse_mm: 25 });
  assert.throws(() => ledger.debit(13, { traverse_mm: 25 }), (error: unknown) => {
    assert.ok(error instanceof BudgetExceeded);
    assert.equal(error.message, 'budget:duration_ticks');
    assert.deepEqual(error.usage, { duration_ticks: 10, traverse_mm: 25, energy_units: 0, tier2_bytes: 0 });
    return true;
  });
  assert.equal(ledger.snapshot(99).usage.duration_ticks, 10);
  assert.equal(ledger.snapshot(99).usage.traverse_mm, 25);
  assert.throws(() => ledger.debit(14, {}), /terminal/);
  const deadline = budget({ deadline_tick: 5 });
  assert.throws(() => deadline.checkTime(5), /budget:deadline_tick/);
  const zero = budget({ budget: limits(0) });
  assert.throws(() => zero.checkTime(0), /budget:duration_ticks/);
});

test('prospective debit is atomic, permits exact non-time ceilings, and keeps reserve exact', () => {
  const ledger = budget({ budget: limits(100, 100, 800, 100) }, 0, 1000);
  ledger.debit(0, { traverse_mm: 100, energy_units: 800, tier2_bytes: 100 });
  assert.equal(ledger.snapshot(0).available_energy_units, 0);
  assert.deepEqual(ledger.snapshot(0).remaining, { duration_ticks: 100, traverse_mm: 0, energy_units: 0, tier2_bytes: 0 });
  const before = ledger.snapshot(0).usage;
  assert.throws(() => ledger.debit(0, { energy_units: 1 }), /budget:energy_units/);
  assert.deepEqual(ledger.snapshot(0).usage, before);
  const atomic = budget({ budget: limits(100, 100, 100, 100) });
  assert.throws(() => atomic.debit(1, { traverse_mm: 100, energy_units: 101 }), /budget:energy_units/);
  assert.equal(atomic.snapshot(1).usage.traverse_mm, 0);
  const reserve = budget({}, 0, 1001);
  assert.equal(reserve.snapshot(0).reserve_energy_units, 201);
  reserve.debit(0, { energy_units: 800 });
  assert.throws(() => reserve.debit(1, { traverse_mm: 100, energy_units: 1 }), ReserveExceeded);
  assert.equal(reserve.snapshot(1).terminal, false);
  assert.equal(reserve.snapshot(1).usage.traverse_mm, 0);
});

test('invalid values and overflow cannot debit a ledger', () => {
  assert.throws(() => budget({}, -1));
  assert.throws(() => budget({}, 0, Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => budget({ revision: 1 }));
  const ledger = budget({ budget: limits(100, Number.MAX_SAFE_INTEGER) });
  assert.throws(() => ledger.debit(0, { energy_units: -1 }));
  assert.throws(() => ledger.debit(0, { traverse_mm: 1, tier2_bytes: Number.NaN }));
  assert.equal(ledger.snapshot(0).usage.traverse_mm, 0);
  ledger.debit(0, { traverse_mm: Number.MAX_SAFE_INTEGER });
  assert.throws(() => ledger.debit(0, { traverse_mm: 1 }), /budget:traverse_mm/);
});

test('linked revisions preserve immutable lineage and cannot replenish counters', () => {
  const original = directive({ budget: limits() });
  const ledger = new LineageBudget(original, 4, 10000);
  ledger.debit(10, { energy_units: 100, traverse_mm: 250 });
  const next: ObjectValue = { ...clone(original), directive_id: 'directive:revision-1', revision: 1, supersedes_directive_id: original.directive_id! };
  for (const changed of [
    { budget: limits(101) }, { campaign_id: 'campaign:changed' }, { author_id: 'actor:other' },
    { asset_id: 'asset:other' }, { deadline_tick: 20001 }, { earliest_start_tick: 1 },
    { permitted_substitutions: ['vantage'] }, { operating_envelope: { min_row: 0, max_row: 1, min_column: 0, max_column: 0 } }
  ]) assert.throws(() => ledger.revise({ ...next, ...changed }, 10), /Revision changed/);
  assert.throws(() => ledger.revise(next, 3), /lineage/);
  assert.throws(() => ledger.revise({ ...next, supersedes_directive_id: 'directive:wrong' }, 10), /lineage/);
  ledger.revise(next, 10);
  assert.equal(ledger.snapshot(11).usage.duration_ticks, 7);
  assert.equal(ledger.snapshot(11).usage.energy_units, 100);
  assert.equal(ledger.snapshot(11).remaining.traverse_mm, 9750);
  assert.throws(() => ledger.revise(next, 11), /lineage/);
  assert.throws(() => ledger.revise({ ...next, revision: 2, directive_id: original.directive_id!, supersedes_directive_id: next.directive_id! }, 11), /lineage/);
  original.budget = limits(10000);
  next.budget = limits(10000);
  assert.equal(ledger.snapshot(11).ceilings.duration_ticks, 100);
  ledger.finish(11);
  assert.deepEqual(ledger.snapshot(99).usage, ledger.snapshot(11).usage);
  assert.throws(() => ledger.revise({ ...next }, 12), /terminal/);
});

test('Tier-2 reservation counts the full canonical payload, rejects corrupt content, and allows sensing before earliest movement', () => {
  const payload: ObjectValue = { reference: { artifact_id: 'artifact:test', artifact_hash: 'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', byte_length: 2, media_type: 'application/json' }, content_base64: 'W10=' };
  const bytes = Buffer.byteLength(canonical(payload));
  assert.ok(bytes > 2);
  const ledger = budget({ budget: limits(100, 10000, 1000, bytes), earliest_start_tick: 10 });
  assert.throws(() => ledger.reserveTier2(0, 'science-artifact', { ...payload, content_base64: 'e30=' }), /integrity/);
  assert.equal(ledger.snapshot(0).usage.tier2_bytes, 0);
  assert.equal(ledger.reserveTier2(0, 'science-artifact', payload), bytes);
  assert.equal(ledger.snapshot(0).usage.tier2_bytes, bytes);
  assert.throws(() => ledger.reserveTier2(1, 'science-artifact', payload), /budget:tier2_bytes/);
  const sensing = budget({ earliest_start_tick: 10 });
  const observation: ObjectValue = { schema_version: 'observation-v0', observation_id: 'observation:test', run_id: 'run:test', asset_id: 'asset:rover-v0', sensor_id: 'sensor:test', observed_tick: 0, observation_type: 'obstacle-range', truth_contact: true, footprint_cells: [{ row: 20, column: 20 }], measurements: [], belief_patch: [] };
  assert.equal(sensing.reserveTier2(0, 'observation', observation), Buffer.byteLength(canonical(observation)));
  assert.throws(() => sensing.reserveTier2(0, 'observation', { ...observation, observed_tick: 1 }), /identity\/time/);
  assert.equal(sensing.reserveTier2(2, 'observation', observation), Buffer.byteLength(canonical(observation)));
});

test('motion uses 15 diagonal ticks, charges first progress once, and carries no leftover', () => {
  const ledger = budget();
  const motion = new EdgeMotion({ row: 20, column: 20 });
  motion.start({ row: 21, column: 21 }, { length_mm: 1414, energy_units: 147 });
  for (let tick = 0; tick < 14; tick++) {
    assert.equal(motion.step(tick, ledger).progress_mm, (tick + 1) * 100);
    assert.deepEqual(motion.occupancy(), { row: 20, column: 20 });
  }
  assert.equal(motion.step(14, ledger).progress_mm, 1414);
  assert.deepEqual(motion.occupancy(), { row: 21, column: 21 });
  motion.start({ row: 21, column: 22 }, { length_mm: 1000, energy_units: 100 });
  assert.throws(() => motion.step(14, ledger), /later executing tick/);
  assert.equal(motion.step(15, ledger).progress_mm, 100);
  assert.equal(ledger.snapshot(15).usage.energy_units, 247);
  assert.equal(ledger.snapshot(15).usage.traverse_mm, 1514);
});

test('abandoned movement retains traverse/full edge energy; failed steps preserve pose', () => {
  const ledger = budget({ budget: limits(100, 250, 1000), earliest_start_tick: 2 });
  const motion = new EdgeMotion({ row: 30, column: 30 });
  motion.start({ row: 30, column: 31 }, { length_mm: 1000, energy_units: 100 });
  assert.throws(() => motion.step(1, ledger), /earliest/);
  assert.equal(ledger.snapshot(1).usage.energy_units, 0);
  motion.step(2, ledger);
  assert.deepEqual(motion.abandon(), { row: 30, column: 30 });
  motion.start({ row: 31, column: 30 }, { length_mm: 1000, energy_units: 101 });
  motion.step(3, ledger);
  const before = motion.pose();
  assert.throws(() => motion.step(4, ledger), /budget:traverse_mm/);
  assert.deepEqual(motion.pose(), before);
  assert.equal(ledger.snapshot(4).usage.energy_units, 201);
  assert.equal(ledger.snapshot(4).usage.traverse_mm, 200);
});
