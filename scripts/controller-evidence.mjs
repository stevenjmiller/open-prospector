import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { canonical, hash } from '../packages/contracts/dist/index.js';
import { materializeSynthetic } from '../packages/simulation-world/dist/index.js';
import { loadMissionFixture, projectScenario, evaluateGatekeeper, buildAcceptedRevision } from '../packages/belief/dist/index.js';
import { Channel } from '../packages/channel/dist/index.js';
import { Connection, defaultInputs } from '../apps/mission-control/dist/index.js';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const fixture=read('design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json');
const scenario=read('design/fixtures/vertical-slice/synthetic-v0.scenario.json');
const original=read('design/fixtures/vertical-slice/directive-v0.json');
const {manifest}=await defaultInputs();
Object.assign(manifest,{run_id:'run:controller-test',fixture_id:fixture.fixture_id,fixture_hash:hash(fixture),scenario_id:scenario.scenario_id,scenario_hash:hash(scenario),directive_id:original.directive_id,directive_hash:hash(original),
  versions:{autonomy:'autonomy.slice-v0',terrain_policy:'terrain.slice-v0',gatekeeper:'pp.no-go.slice-v0',sensor:'synthetic-sensors-v0',body:'grid-rover-v0'},recorded_model_results:read('fixtures/controller-v0/model-results.json')});
const root=resolve(process.argv[2]??'artifacts/controller-run');mkdirSync(root);
const fixtureRoot=join(root,'fixture');materializeSynthetic(fixtureRoot,fixture);
writeFileSync(join(fixtureRoot,'fixture-manifest.json'),canonical(fixture)+'\n');
for(const [name,value] of Object.entries({manifest,scenario,directive:original}))writeFileSync(join(root,name+'.json'),canonical(value)+'\n');
const mission=loadMissionFixture(fixtureRoot,fixture,manifest.run_id,scenario.asset.asset_id);
const missionProjection=projectScenario(scenario,'mission'),catalog=missionProjection.target_entities;
const actor=missionProjection.scripted_mission_control;
assert.equal(evaluateGatekeeper(original,mission,catalog).accepted,true);
const channel=new Channel(manifest.run_id,manifest.channel,0);
channel.enqueue({direction:'mission-to-asset',tier:'tier-1',priority:220,sent_tick:0,payload_kind:'cleared-directive',payload:original});
const connection=new Connection(resolve('apps/fleet-endpoint/dist/cli.js'));
const trace=[],pending=[];let current=original,revisionOrdinal=0,terminal=null,checkpoint=null;
try {
  await connection.request({frame:'init',run_manifest:manifest,scenario,fixture_root:fixtureRoot});
  for(let tick=1;tick<25000;tick++) {
    const due=channel.deliver(tick);
    for(const message of due.filter(m=>m.direction==='asset-to-mission')) {
      mission.receive(message,tick);
      if(message.payload_kind==='contestation'&&message.payload.level===2)pending.push({tick:tick+actor.response_delay_ticks,offer:message.payload});
      if(message.payload_kind==='endpoint-event'&&message.payload.event_type==='endpoint-state-changed'&&['completed','failed','locked','faulted'].includes(message.payload.payload.to))terminal=message.payload.payload.to;
    }
    for(const action of pending.filter(p=>p.tick===tick)) {
      const alternative=action.offer.alternatives.find(a=>a.kind===actor.accept_alternative_kind);assert.ok(alternative);
      current=buildAcceptedRevision(current,alternative,{contestation_id:action.offer.contestation_id,alternative_id:alternative.alternative_id,accepted_by:current.author_id,accepted_tick:tick},`directive:accepted-${revisionOrdinal++}`);
      assert.equal(evaluateGatekeeper(current,mission,catalog).accepted,true);
      channel.enqueue({direction:'mission-to-asset',tier:'tier-1',priority:220,sent_tick:tick,payload_kind:'directive-revision',payload:current});
    }
    const response=await connection.request({frame:'advance',to_tick:tick,deliveries:due.filter(m=>m.direction==='mission-to-asset')});
    for(const intent of response.intents){channel.enqueue(intent);trace.push(intent);}
    if(terminal) {checkpoint=(await connection.request({frame:'checkpoint',at_tick:tick})).frame;break;}
  }
  await connection.stop();
} catch(error) {await connection.abort();throw error;}
writeFileSync(join(root,'endpoint-intents.ndjson'),trace.map(canonical).join('\n')+'\n');
const report={profile:'endpoint-controller-evidence-v0',terminal,checkpoint,received_belief_hash_at_terminal_notice:mission.stateHash(),levels:trace.filter(i=>i.payload_kind==='contestation').map(i=>i.payload.level),transitions:trace.filter(i=>i.payload_kind==='endpoint-event'&&i.payload.event_type==='endpoint-state-changed').map(i=>({tick:i.sent_tick,...i.payload.payload})),classifier_results:trace.filter(i=>i.payload_kind==='endpoint-event'&&i.payload.event_type==='classifier-result-consumed').map(i=>i.payload.payload)};
writeFileSync(join(root,'report.json'),canonical(report)+'\n');
assert.equal(terminal,'completed');assert.deepEqual(report.levels,[2,0]);assert.equal(report.classifier_results.length,1);
console.log(`Controller completed with Levels 2 and 0 and recorded classifier: ${root}`);
