import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical, clone, hash, type Intent, type Message, type ObjectValue } from '@open-prospector/contracts';
import { RecordedClassifier, type ClassifierPort } from '@open-prospector/autonomy';
import { createFixture, drive, directive, scenario } from './controller-fixture.js';

function nearby() {
  const original=clone(directive), world=clone(scenario);
  delete original.advisory_route;
  world.target_entities[0].cell={row:220,column:32};
  return {directive:original,scenario:world,latency:0};
}
function transitions(intents:Intent[]) {
  return intents.filter(i=>i.payload_kind==='endpoint-event'&&i.payload.event_type==='endpoint-state-changed').map(i=>i.payload.payload as ObjectValue);
}
function next(context:ReturnType<typeof createFixture>,extra:Message[]=[]):Intent[] {
  const tick=context.controller.tick+1;
  const due=context.channel.deliver(tick).filter(m=>m.direction==='mission-to-asset');
  const emitted=context.controller.advance(tick,[...due,...extra]);
  for(const intent of emitted)context.channel.enqueue(intent);
  return emitted;
}

test('safe original plans schedule strictly before execution and complete without negotiation',()=>{
  const context=createFixture(nearby());
  const first=next(context);
  assert.deepEqual(transitions(first).map(t=>t.to),['planning','scheduled']);
  const plan=first.find(i=>i.payload_kind==='plan-summary')!;
  assert.equal(plan.payload.planned_start_tick,2);
  assert.equal((context.controller.checkpoint().pose as ObjectValue).progress_mm,0);
  assert.deepEqual(transitions(next(context)).map(t=>t.to),['executing']);
  assert.equal((context.controller.checkpoint().pose as ObjectValue).progress_mm,100);
  const remaining:Intent[]=[];
  while(context.controller.state==='executing')remaining.push(...next(context));
  assert.equal(context.controller.state,'completed');
  assert.equal(remaining.filter(i=>i.payload_kind==='contestation').length,0);
  assert.equal(context.recorded.length,0);
});

test('ordinary linked supersession releases a hold through planning without fabricated acceptance',()=>{
  const context=createFixture({latency:0});next(context);
  assert.equal(context.controller.state,'holding');
  const revision=clone(context.original);
  revision.directive_id='directive:ordinary-supersession';revision.revision=1;
  revision.supersedes_directive_id=context.original.directive_id;
  revision.observation_cell={row:180,column:70};delete revision.advisory_route;
  context.channel.enqueue({direction:'mission-to-asset',tier:'tier-1',priority:220,sent_tick:context.controller.tick,payload_kind:'directive-revision',payload:revision});
  const events:Intent[]=[];
  for(let i=0;i<10&&context.controller.state==='holding';i++)events.push(...next(context));
  const moved=transitions(events);
  assert.ok(moved.some(t=>t.from==='holding'&&t.to==='planning'&&t.reason_code==='linked-supersession'));
  assert.equal(context.controller.state,'scheduled');
  assert.equal((context.controller.checkpoint().directive as ObjectValue).accepted_alternative,undefined);
});

test('runtime open negotiation window holds with Level 2 and does not invoke classifier',()=>{
  const context=createFixture({latency:0});
  const result=drive(context,{maxTick:650});
  const runtime=result.intents.find(i=>i.payload_kind==='contestation'&&i.payload.hazard_class==='obstacle');
  assert.ok(runtime,'Actual route must reach the hidden runtime rock');
  assert.equal(runtime.payload.level,2);assert.equal(runtime.payload.window_open,true);
  assert.ok(Number(runtime.payload.time_to_harm_ticks)>0);
  assert.ok(result.transitions.some(t=>t.from==='executing'&&t.to==='holding'));
  assert.equal(result.recorded.length,0);
});

test('deadline wins over malformed delivery at equality and terminal budget remains frozen',()=>{
  const original=clone(directive);original.deadline_tick=1000;
  const context=createFixture({directive:original,latency:0});
  drive(context,{accept:false,maxTick:999});assert.equal(context.controller.state,'holding');
  const emitted=next(context,[{} as Message]);
  assert.equal(context.controller.state,'failed');
  assert.equal(transitions(emitted).at(-1)!.reason_code,'budget:deadline_tick');
  assert.ok(!emitted.some(i=>i.payload.event_type==='endpoint-fault'));
  const budget=context.controller.checkpoint().budget;
  next(context);assert.deepEqual(context.controller.checkpoint().budget,budget);
});

test('mid-edge invariant failure holds the exact pose and performs no further motion',()=>{
  const context=createFixture({...nearby(),wrap:s=>({...s,obstacleRange(pose,path,metadata){if(metadata.observed_tick===3)throw new Error('injected sensor fault');return s.obstacleRange(pose,path,metadata);}})});
  next(context);next(context);
  const before=context.controller.checkpoint().pose;
  const failed=next(context);
  assert.equal(context.controller.state,'faulted');
  assert.deepEqual(context.controller.checkpoint().pose,before);
  assert.equal(transitions(failed).at(-1)!.to,'faulted');
  next(context);assert.deepEqual(context.controller.checkpoint().pose,before);
});

test('mandatory final artifact budget failure cannot report completed',()=>{
  const prepared=drive(createFixture(nearby()));
  assert.equal(prepared.checkpoint.state,'completed');
  const tier2=prepared.intents.filter(i=>i.tier==='tier-2').reduce((sum,i)=>sum+Buffer.byteLength(canonical(i.payload)),0);
  const options=nearby();options.directive.budget.tier2_bytes=tier2-1;
  const result=drive(createFixture(options));
  assert.equal(result.checkpoint.state,'failed');
  assert.equal(result.transitions.at(-1)!.reason_code,'budget:tier2_bytes');
  assert.ok(!result.transitions.some(t=>t.to==='completed'));
  assert.ok(!result.intents.some(i=>i.payload_kind==='science-artifact'));
});

test('indeterminate mandatory spectral evidence cannot complete the directive',()=>{
  const context=createFixture({...nearby(),wrap:s=>({...s,standoff(cell,target,metadata){
    const observation=s.standoff(cell,target,metadata);
    observation.measurements=(observation.measurements as ObjectValue[]).map(item=>item.name==='spectral_class'?{...item,value:'indeterminate'}:item);
    return observation;
  }})});
  const result=drive(context);
  assert.equal(result.checkpoint.state,'faulted');
  assert.ok(!result.transitions.some(t=>t.to==='completed'));
  assert.ok(!result.intents.some(i=>i.payload_kind==='science-artifact'));
  assert.ok(result.intents.some(i=>i.payload.event_type==='endpoint-fault'&&String((i.payload.payload as ObjectValue).detail).includes('Mandatory science evidence')));
});

test('wrong recorded classifier input faults only after a completed reflex stop',()=>{
  const output={model_id:'model:stub-rock-v0',label:'rock',confidence_ppm:900000};
  const seam=new RecordedClassifier([{seam_id:'seam:rock-classifier-v0',input_hash:hash({wrong:true}),output_hash:hash(output),output}]);
  const called:{state:string}[]=[];
  const classifier:ClassifierPort={consume(state,input){called.push({state});return seam.consume(state,input);},snapshot(){return seam.snapshot();}};
  const result=drive(createFixture({classifier}));
  assert.equal(result.checkpoint.state,'faulted');
  const reflex=result.intents.find(i=>i.payload_kind==='contestation'&&i.payload.level===0)!;
  assert.ok(reflex);assert.deepEqual(called,[{state:'safe-hold'}]);
  const fault=result.intents.find(i=>i.payload_kind==='endpoint-event'&&i.payload.event_type==='endpoint-fault')!;
  assert.ok(fault.sent_tick>reflex.sent_tick);
  assert.ok(!result.intents.some(i=>i.payload_kind==='endpoint-event'&&i.payload.event_type==='classifier-result-consumed'));
});
