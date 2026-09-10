import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { canonical, hash, type ObjectValue, type Intent } from '@open-prospector/contracts';
import { materializeSynthetic } from '@open-prospector/simulation-world';
import { buildAcceptedRevision, evaluateGatekeeper } from '@open-prospector/belief';
import { Connection, defaultInputs } from '@open-prospector/mission-control';
import { createFixture, drive, fixture, scenario, directive, replayedFixture } from './controller-fixture.js';

test('real endpoint IPC profile matches direct controller, including recorded seam and final checkpoint',async()=>{
  const prepared=drive(createFixture({latency:5}));
  assert.equal(prepared.checkpoint.state,'completed');
  const context=replayedFixture(prepared.recorded,{latency:5});
  const expected=drive(context);
  const root=join(mkdtempSync(join(tmpdir(),'prospector-controller-')),'fixture');
  materializeSynthetic(root,fixture);writeFileSync(join(root,'fixture-manifest.json'),canonical(fixture)+'\n');
  const {manifest}=await defaultInputs();
  Object.assign(manifest,{run_id:context.config.run_id,fixture_id:fixture.fixture_id,fixture_hash:hash(fixture),scenario_id:scenario.scenario_id,scenario_hash:hash(scenario),directive_id:directive.directive_id,directive_hash:hash(directive),recorded_model_results:prepared.recorded});
  manifest.channel={one_way_latency_ticks:5,tier1_bytes_per_tick:4096,tier2_bytes_per_tick:1024};
  manifest.versions={autonomy:'autonomy.slice-v0',terrain_policy:'terrain.slice-v0',gatekeeper:'pp.no-go.slice-v0',sensor:'synthetic-sensors-v0',body:'grid-rover-v0'};
  const connection=new Connection(resolve('apps/fleet-endpoint/dist/cli.js'));
  const local=createFixture({latency:5});const actual:Intent[]=[];const pending:{tick:number;offer:ObjectValue}[]=[];
  let current=directive,ordinal=0;
  try {
    await connection.request({frame:'init',run_manifest:manifest,scenario,fixture_root:root});
    for(let tick=1;tick<=Number(expected.checkpoint.tick);tick++) {
      const due=local.channel.deliver(tick);
      for(const m of due)if(m.payload_kind==='contestation'&&m.payload.level===2)pending.push({tick:tick+10,offer:m.payload});
      for(const action of pending.filter(p=>p.tick===tick)) {
        const alternative=(action.offer.alternatives as ObjectValue[])[0]!;
        current=buildAcceptedRevision(current,alternative,{contestation_id:action.offer.contestation_id!,alternative_id:alternative.alternative_id!,accepted_by:current.author_id,accepted_tick:tick},`directive:accepted-${ordinal++}`);
        assert.equal(evaluateGatekeeper(current,local.belief,local.config.targets).accepted,true);
        local.channel.enqueue({direction:'mission-to-asset',tier:'tier-1',priority:220,sent_tick:tick,payload_kind:'directive-revision',payload:current});
      }
      const response=await connection.request({frame:'advance',to_tick:tick,deliveries:due.filter(m=>m.direction==='mission-to-asset') as unknown as ObjectValue[]});
      actual.push(...response.intents); for(const intent of response.intents)local.channel.enqueue(intent);
    }
    assert.equal(canonical(actual),canonical(expected.intents));
    const reply=await connection.request({frame:'checkpoint',at_tick:Number(expected.checkpoint.tick)});
    assert.equal(reply.frame.state_hash,hash(expected.checkpoint));
    await connection.stop();
  } catch(error) {await connection.abort();throw error;}
});
