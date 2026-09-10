import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, clone, hash, hashBytes, type ObjectValue } from '@open-prospector/contracts';
import { materializeSynthetic } from '@open-prospector/simulation-world';
import { verifyFile } from '@open-prospector/record';
import { runCampaign, defaultCampaignInputs, verifyCampaign } from '@open-prospector/mission-control';

async function prepare() {
  const root=await mkdtemp(join(tmpdir(),'op-campaign-'));
  const inputs=await defaultCampaignInputs();
  // Keep the frozen classifier's latency/input binding, but force science to lag terminal notice.
  (inputs.manifest.channel as ObjectValue).tier2_bytes_per_tick=128;
  const fixtureRoot=join(root,'fixture');materializeSynthetic(fixtureRoot,inputs.fixture);
  return {root,inputs,fixtureRoot};
}
async function lines(path:string):Promise<ObjectValue[]> {
  return (await readFile(path,'utf8')).trimEnd().split('\n').filter(Boolean).map(line=>JSON.parse(line) as ObjectValue);
}

test('full campaign replays in fresh endpoint processes, drains science, and rejects damaged archives',async t=>{
  const {root,inputs,fixtureRoot}=await prepare();
  const first=await runCampaign({output:join(root,'first'),inputs,fixtureRoot});
  assert.equal(first.status,'completed');
  const second=await runCampaign({output:join(root,'second'),inputs,fixtureRoot});
  assert.equal(second.status,'completed');assert.equal(first.head,second.head);assert.equal(first.finalStateHash,second.finalStateHash);
  for(const name of ['events.ndjson','telemetry.ndjson'])assert.equal(await readFile(join(first.output,name),'utf8'),await readFile(join(second.output,name),'utf8'),name);
  const verified=await verifyCampaign(first.output);
  const events=verified.events;
  const terminal=events.find(e=>e.event_type==='endpoint-state-changed'&&e.payload.to==='completed')!;
  assert.ok(terminal,'endpoint completion is recorded');
  const telemetry=await lines(join(first.output,'telemetry.ndjson'));
  const science=telemetry.find(m=>m.payload_kind==='science-artifact')!;
  assert.ok(science,'science artifact is delivered through the channel');
  assert.ok(Number(science.deliver_at_tick)>Number(terminal.recorded_tick),'slow Tier-2 science arrives after the Tier-1 terminal notice');
  assert.ok(Number(events.at(-1)!.recorded_tick)>=Number(science.deliver_at_tick));
  assert.equal(events.at(-1)!.event_type,'run-completed');
  assert.equal(events.at(-1)!.payload.event_chain_head,events.at(-2)!.event_hash);
  assert.deepEqual(events.filter(e=>e.event_type==='contestation-opened').map(e=>e.payload.level),[2,0]);
  const receipt=events.find(e=>e.event_type==='directive-received')!;
  assert.ok(Number(receipt.received_tick)>Number(receipt.occurred_tick));
  const observationNames=await readdir(join(first.output,'observations'));
  const scienceNames=await readdir(join(first.output,'science'));
  assert.ok(observationNames.length>1);assert.ok(scienceNames.length>0);
  for(const mutation of ['missing-observation','tampered-observation','missing-science','tampered-science','missing-telemetry','tampered-telemetry','missing-fixture','tampered-fixture']) {
    await t.test(mutation,async()=>{
      const output=join(root,mutation);await cp(first.output,output,{recursive:true});
      const layer=(inputs.fixture.layers as ObjectValue[])[0]!;
      const path=mutation.endsWith('observation')?join(output,'observations',observationNames[0]!):mutation.endsWith('science')?join(output,'science',scienceNames[0]!):mutation.endsWith('fixture')?join(output,'fixture',String(layer.path)):join(output,'telemetry.ndjson');
      if(mutation.startsWith('missing'))await rm(path);else await writeFile(path,'{}\n');
      await assert.rejects(verifyCampaign(output),{ name: 'Error' },mutation);
    });
  }
  const incomplete=join(root,'incomplete');await cp(first.output,incomplete,{recursive:true});
  const text=await readFile(join(incomplete,'events.ndjson'),'utf8');
  await writeFile(join(incomplete,'events.ndjson'),text.trimEnd().split('\n').slice(0,-1).join('\n')+'\n');
  assert.equal((await verifyCampaign(incomplete)).status,'incomplete');
  await t.test('a coherently rehashed acceptance forgery fails causal audit',async()=>{
    const output=join(root,'forged-acceptance');await cp(first.output,output,{recursive:true});
    const forged=clone(events),acceptance=forged.find(e=>e.event_type==='alternative-accepted')!;
    acceptance.payload.accepted_tick=Number(acceptance.payload.accepted_tick)+1;
    let previous:string|null=null;
    for(const event of forged) {
      event.prev_event_hash=previous;
      if(event.event_type==='run-completed')event.payload.event_chain_head=previous;
      event.payload_hash=hash(event.payload);
      const {event_hash:_old,...body}=event;event.event_hash=hash(body);previous=event.event_hash;
    }
    await writeFile(join(output,'events.ndjson'),forged.map(canonical).join('\n')+'\n');
    assert.equal(verifyFile(join(output,'events.ndjson')).status,'completed','ordinary hash-chain integrity passes');
    await assert.rejects(verifyCampaign(output),/Campaign audit:.*alternative-accepted/);
  });

  await t.test('a protocol-only hardware double preserves command, telemetry and archive semantics',async()=>{
    const tape=join(root,'endpoint-tape.json'),endpointPath=join(root,'hardware-tape.mjs');
    await writeFile(tape,canonical({messages:telemetry,state_hash:first.finalStateHash!}));
    // This explicit tape double has no planner, world, sensor or classifier implementation.
    // It validates every incoming directive delivery and returns previously observed wire behavior.
    await writeFile(endpointPath,`
import { readFileSync } from 'node:fs';
import { canonical, FrameDecoder } from ${JSON.stringify(pathToFileURL(resolve('packages/contracts/dist/index.js')).href)};
const tape=JSON.parse(readFileSync(${JSON.stringify(tape)},'utf8')),decoder=new FrameDecoder();
const ordered=[...tape.messages].sort((a,b)=>a.creation_ordinal-b.creation_ordinal);
const emit=value=>process.stdout.write(canonical(value)+'\\n');let tick=0;
process.stdin.on('data',chunk=>{for(const request of decoder.push(chunk)){
 if(request.frame==='init'){tick=request.run_manifest.clock.start_tick;emit({frame:'ready',run_id:request.run_manifest.run_id});}
 else if(request.frame==='advance'){
  tick=request.to_tick;
  const expected=tape.messages.filter(m=>m.direction==='mission-to-asset'&&m.deliver_at_tick===tick);
  if(canonical(request.deliveries)!==canonical(expected))throw new Error('Hardware command boundary changed');
  for(const m of ordered.filter(m=>m.direction==='asset-to-mission'&&m.sent_tick===tick)){
   const {direction,tier,priority,sent_tick,payload_kind,payload}=m;emit({frame:'emit',intent:{direction,tier,priority,sent_tick,payload_kind,payload}});
  }
  emit({frame:'done',at_tick:tick});
 }else if(request.frame==='checkpoint')emit({frame:'checkpoint-result',at_tick:tick,state_hash:tape.state_hash});
 else if(request.frame==='shutdown'){emit({frame:'stopped',at_tick:tick});process.stdin.pause();process.stdin.destroy();}
}});
`);
    const substituted=await runCampaign({output:join(root,'hardware-tape'),inputs,fixtureRoot,endpointPath});
    assert.equal(substituted.status,'completed');assert.equal(substituted.head,first.head);
    assert.equal(substituted.finalStateHash,first.finalStateHash);
    assert.equal(await readFile(join(substituted.output,'telemetry.ndjson'),'utf8'),await readFile(join(first.output,'telemetry.ndjson'),'utf8'));
  });

  await t.test('unsensed truth changes provenance but not endpoint messages or received belief',async()=>{
    for(const message of telemetry.filter(m=>m.payload_kind==='observation')) {
      assert.equal(((message.payload as ObjectValue).footprint_cells as ObjectValue[]).some(c=>c.row===255&&c.column===255),false,'mutated cell is absent from every emitted observation footprint');
    }
    const changed=clone(inputs),mutatedRoot=join(root,'mutated-fixture');await cp(fixtureRoot,mutatedRoot,{recursive:true});
    const layer=(changed.fixture.layers as ObjectValue[]).find(l=>l.name==='truth-elevation')!;
    const path=join(mutatedRoot,String(layer.path)),bytes=await readFile(path);
    // Outside all sensing in this scenario; initial asset and mission layers stay byte-identical.
    bytes.writeInt32LE(bytes.readInt32LE((255*256+255)*4)+12345,(255*256+255)*4);
    await writeFile(path,bytes);layer.hash=hashBytes(bytes);
    (changed.fixture.source as ObjectValue).source_hash=hash({test:'unsensed-elevation-change',layers:changed.fixture.layers!});
    changed.manifest.fixture_hash=hash(changed.fixture);
    const result=await runCampaign({output:join(root,'unsensed'),inputs:changed,fixtureRoot:mutatedRoot});
    assert.equal(result.status,'completed');assert.notEqual(result.head,first.head);
    const changedTelemetry=await lines(join(result.output,'telemetry.ndjson'));
    assert.equal(canonical(changedTelemetry),canonical(telemetry),'truth cannot affect observer-visible messages without a sensor contact');
    const changedEvents=(await verifyCampaign(result.output)).events;
    const beliefs=events.filter(e=>e.event_type==='received-belief-updated').map(e=>e.payload);
    assert.equal(canonical(changedEvents.filter(e=>e.event_type==='received-belief-updated').map(e=>e.payload)),canonical(beliefs));
    assert.equal(result.finalStateHash,first.finalStateHash);
  });
});

test('public geofence rejection happens before transmission and produces no rover contestation',async()=>{
  const {root,inputs,fixtureRoot}=await prepare();
  inputs.directive.target={kind:'cell',cell:{row:0,column:0}};
  inputs.directive.observation_cell={row:0,column:0};
  inputs.manifest.directive_hash=hash(inputs.directive);
  const result=await runCampaign({output:join(root,'rejected'),inputs,fixtureRoot});
  assert.equal(result.status,'failed');assert.equal(result.finalStateHash,undefined);
  const events=(await verifyCampaign(result.output)).events;
  assert.ok(events.some(e=>e.event_type==='gatekeeper-evaluated'&&e.payload.accepted===false));
  assert.equal(events.some(e=>['directive-transmitted','contestation-opened','run-completed'].includes(e.event_type)),false);
  assert.equal(events.at(-1)!.event_type,'run-failed');
});

test('zero latency changes negotiation timing without consuming the closed-window classifier',async()=>{
  const {root,inputs,fixtureRoot}=await prepare();
  (inputs.manifest.channel as ObjectValue).one_way_latency_ticks=0;
  const result=await runCampaign({output:join(root,'zero-latency'),inputs,fixtureRoot});
  assert.equal(result.status,'completed');
  const events=(await verifyCampaign(result.output)).events;
  assert.deepEqual(events.filter(e=>e.event_type==='contestation-opened').map(e=>e.payload.level),[2,2]);
  assert.equal(events.filter(e=>e.event_type==='alternative-accepted').length,2);
  assert.equal(events.some(e=>e.event_type==='classifier-result-consumed'),false);
});

for(const mode of ['crash','malformed','hang'])test(`substituted endpoint ${mode} cannot close a successful campaign`,async()=>{
  const {root,inputs,fixtureRoot}=await prepare();
  const endpointPath=join(root,'hardware-double.mjs');
  const script=mode==='crash'?'process.exit(7);':mode==='malformed'?"process.stdout.write('not-json\\n'); process.stdin.resume();":"process.stdin.resume();";
  await writeFile(endpointPath,script);
  const result=await runCampaign({output:join(root,'failure'),inputs,fixtureRoot,endpointPath,watchdogMs:1000});
  assert.equal(result.status,'failed');assert.equal(result.finalStateHash,undefined);
  const events=(await verifyCampaign(result.output)).events;
  assert.equal(events.at(-1)!.event_type,'run-failed');
  assert.equal(events.some(e=>e.event_type==='run-completed'),false);
});
