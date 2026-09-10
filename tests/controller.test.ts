import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canonical, clone, hash, type ObjectValue } from '@open-prospector/contracts';
import { createFixture, drive, replayedFixture, directive } from './controller-fixture.js';

test('actual controller negotiates, preserves target, stops before classifier and completes mandatory evidence',()=>{
  const prepared=drive(createFixture());
  assert.equal(prepared.checkpoint.state,'completed',canonical(prepared.transitions));
  assert.equal(prepared.recorded.length,1);
  assert.equal(canonical(prepared.recorded),canonical(JSON.parse(readFileSync('fixtures/controller-v0/model-results.json','utf8'))));
  const actual=drive(replayedFixture(prepared.recorded));
  assert.equal(actual.checkpoint.state,'completed');
  assert.equal(canonical(actual.intents),canonical(prepared.intents));
  const contests=actual.intents.filter(i=>i.payload_kind==='contestation');
  assert.deepEqual(contests.map(i=>i.payload.level),[2,0]);
  assert.equal((contests[0]!.payload.alternatives as ObjectValue[]).length,2);
  const receipt=actual.intents.filter(i=>i.payload_kind==='endpoint-event'&&i.payload.event_type==='directive-received');
  assert.deepEqual((receipt[1]!.payload.payload as ObjectValue).target,directive.target);
  assert.deepEqual((receipt[1]!.payload.payload as ObjectValue).observation_cell,{row:180,column:70});
  const reflexTick=contests[1]!.sent_tick;
  const classifier=actual.intents.find(i=>i.payload_kind==='endpoint-event'&&i.payload.event_type==='classifier-result-consumed')!;
  assert.ok(classifier.sent_tick>reflexTick);
  const reflex=contests[1]!.payload.reflex_inputs as ObjectValue;
  assert.ok(Number(reflex.distance_mm)>Number(reflex.stopping_distance_mm));
  assert.ok(actual.intents.some(i=>i.payload_kind==='science-artifact'));
  const again=drive(replayedFixture(prepared.recorded));
  assert.equal(canonical(again.checkpoint),canonical(actual.checkpoint));
  const mutated=drive(replayedFixture(prepared.recorded,{mutateUnsensed:true}));
  assert.equal(canonical(mutated.intents),canonical(actual.intents));
});

test('no permitted alternative locks and late Studio revision cannot release it',()=>{
  const original=clone(directive); original.permitted_substitutions=[];
  const context=createFixture({directive:original,latency:0});
  const result=drive(context);
  assert.equal(result.checkpoint.state,'locked');
  const contest=result.intents.find(i=>i.payload_kind==='contestation')!;
  assert.equal(contest.payload.level,3); assert.deepEqual(contest.payload.alternatives,[]);
  const before=(context.controller.checkpoint().budget as ObjectValue).usage;
  const payload={...original,directive_id:'directive:forbidden-release',revision:1,supersedes_directive_id:original.directive_id};
  const message={...context.message,message_id:'message:late',creation_ordinal:999,sent_tick:context.controller.tick,deliver_at_tick:context.controller.tick+1,payload_kind:'directive-revision',payload,payload_hash:hash(payload),payload_bytes:Buffer.byteLength(canonical(payload))};
  const ignored=context.controller.advance(context.controller.tick+1,[message]);
  assert.equal(ignored.length,1);assert.equal(ignored[0]!.payload.reason_code,'ignored-terminal');
  assert.equal(context.controller.state,'locked'); assert.deepEqual((context.controller.checkpoint().budget as ObjectValue).usage,before);
});

test('directive budget infeasibility is failed rather than Level 3',()=>{
  const original=clone(directive);original.budget.traverse_mm=1;
  const result=drive(createFixture({directive:original,latency:0}));
  assert.equal(result.checkpoint.state,'failed');
  assert.equal(result.transitions.at(-1)!.reason_code,'budget:traverse_mm');
  assert.equal(result.intents.filter(i=>i.payload_kind==='contestation').length,0);
});
