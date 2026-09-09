import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { clone, type ObjectValue } from '@open-prospector/contracts';
import { buildAcceptedRevision, evaluateGatekeeper, validateAcceptedRevision } from '@open-prospector/belief';

const fixture = JSON.parse(readFileSync(new URL('../../design/contracts/v0/examples/negotiation.json', import.meta.url), 'utf8')) as ObjectValue;
const targets = [{ entity_id: 'target:hydrated-primary', cell: { row: 180, column: 80 } }];
const clear = { cell: () => ({ geofence: false }) };
const alternatives = (fixture.contestation as ObjectValue).alternatives as ObjectValue[];

test('accepted revision matches the frozen negotiation object without modifying original inputs', () => {
  const before = clone(fixture);
  const result = buildAcceptedRevision(fixture.original, alternatives[0], fixture.acceptance, String((fixture.revision as ObjectValue).directive_id));
  assert.deepEqual(result, fixture.revision);
  validateAcceptedRevision(fixture.original, result, fixture.contestation, 6012);
  assert.deepEqual(fixture, before);
  assert.deepEqual(result.target, (fixture.original as ObjectValue).target);
  assert.equal(result.source_text, undefined);
  assert.equal(result.advisory_route, undefined);
});

test('target substitution replaces target and copies the exact offered route without granting budget', () => {
  const offer = clone(fixture.contestation) as ObjectValue;
  const alternative = (offer.alternatives as ObjectValue[])[1]!;
  alternative.proposed_route = [{ row: 220, column: 30 }, { row: 185, column: 95 }];
  const acceptance = { ...(fixture.acceptance as ObjectValue), alternative_id: alternative.alternative_id! };
  const result = buildAcceptedRevision(fixture.original, alternative, acceptance, 'directive:target-r1');
  validateAcceptedRevision(fixture.original, result, offer, 6013);
  assert.deepEqual(result.target, { kind: 'entity', entity_id: 'target:hydrated-substitute' });
  assert.deepEqual(result.observation_cell, { row: 185, column: 95 });
  assert.deepEqual(result.advisory_route, alternative.proposed_route);
  assert.deepEqual(result.budget, (fixture.original as ObjectValue).budget);
  (result.advisory_route as ObjectValue[])[0]!.row = 1;
  assert.equal((alternative.proposed_route as ObjectValue[])[0]!.row, 220);
});

test('stored offer validation rejects stale, forged and transformed-field tampering', () => {
  const changes: ((revision: ObjectValue) => void)[] = [
    r => { r.directive_id = (fixture.original as ObjectValue).directive_id!; },
    r => { r.supersedes_directive_id = 'directive:stale'; },
    r => { r.revision = 2; },
    r => { r.author_id = 'actor:forged'; },
    r => { r.asset_id = 'asset:other'; },
    r => { r.target = { kind: 'cell', cell: { row: 180, column: 70 } }; },
    r => { r.observation_cell = { row: 180, column: 71 }; },
    r => { (r.budget as ObjectValue).energy_units = 40001; },
    r => { r.deadline_tick = 20001; },
    r => { r.source_text = 'forged'; },
    r => { r.advisory_route = []; },
    r => { (r.accepted_alternative as ObjectValue).alternative_id = 'alternative:forged'; },
    r => { (r.accepted_alternative as ObjectValue).contestation_id = 'contestation:stale'; },
    r => { (r.accepted_alternative as ObjectValue).accepted_by = 'actor:forged'; },
    r => { (r.accepted_alternative as ObjectValue).accepted_tick = 3000; },
    r => { (r.accepted_alternative as ObjectValue).accepted_tick = 6013; }
  ];
  for (const change of changes) {
    const revision = clone(fixture.revision) as ObjectValue;
    change(revision);
    assert.throws(() => validateAcceptedRevision(fixture.original, revision, fixture.contestation, 6012));
  }
  for (const field of ['directive_id', 'asset_id', 'preserved_goal_id']) {
    const offer = clone(fixture.contestation) as ObjectValue;
    offer[field] = 'id:stale';
    assert.throws(() => validateAcceptedRevision(fixture.original, fixture.revision, offer, 6012));
  }
});

test('transformation rejects disallowed substitutions and loss of goal or success evidence', () => {
  const original = clone(fixture.original) as ObjectValue;
  original.permitted_substitutions = ['target'];
  assert.throws(() => buildAcceptedRevision(original, alternatives[0], fixture.acceptance, 'directive:new'));
  for (const patch of [{ preserved_goal_id: 'goal:other' }, { requested_evidence: ['position-safe'] }]) {
    assert.throws(() => buildAcceptedRevision(fixture.original, { ...alternatives[0], ...patch }, fixture.acceptance, 'directive:new'));
  }
});

test('gatekeeper covers target, observation cell, expanded route and every envelope cell with sorted unique evidence', () => {
  const directive = clone(fixture.original) as ObjectValue;
  directive.target = { kind: 'cell', cell: { row: 5, column: 5 } };
  directive.observation_cell = { row: 3, column: 3 };
  directive.advisory_route = [{ row: 8, column: 1 }, { row: 8, column: 5 }, { row: 8, column: 1 }];
  directive.operating_envelope = { min_row: 10, max_row: 12, min_column: 10, max_column: 12 };
  const blocked = new Set(['5,5', '3,3', '8,3', '11,11']);
  const result = evaluateGatekeeper(directive, { cell: c => ({ geofence: blocked.has(`${c.row},${c.column}`) }) }, []);
  assert.deepEqual(result, { directive_id: directive.directive_id, accepted: false, rule_id: 'pp.no-go.slice-v0', evidence_cells: [{ row: 3, column: 3 }, { row: 5, column: 5 }, { row: 8, column: 3 }, { row: 11, column: 11 }] });
  assert.equal(evaluateGatekeeper(directive, clear, []).accepted, true);
  assert.throws(() => evaluateGatekeeper(fixture.original, clear, []));
  assert.throws(() => evaluateGatekeeper(fixture.original, clear, [...targets, ...targets]));
});

test('an accepted alternative remains subject to independent gatekeeper reevaluation', () => {
  const original = clone(fixture.original) as ObjectValue;
  original.operating_envelope = { min_row: 220, max_row: 220, min_column: 30, max_column: 30 };
  const geofence = { cell: (c: { row: number; column: number }) => ({ geofence: c.row === 180 && c.column === 70 }) };
  assert.equal(evaluateGatekeeper(original, geofence, targets).accepted, true);
  const revision = buildAcceptedRevision(original, alternatives[0], fixture.acceptance, 'directive:new');
  validateAcceptedRevision(original, revision, fixture.contestation, 6012);
  assert.deepEqual(evaluateGatekeeper(revision, geofence, targets).evidence_cells, [{ row: 180, column: 70 }]);
});
