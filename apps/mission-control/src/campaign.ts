import { mkdir, readFile, writeFile, readdir, copyFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, clone, hash, hashBytes, validate, validateFixture, readRasterFile, type ObjectValue, type Json, type ChannelProfile, type EndpointEvent } from '@open-prospector/contracts';
import { loadMissionFixture, projectScenario, evaluateGatekeeper, buildAcceptedRevision } from '@open-prospector/belief';
import { Channel } from '@open-prospector/channel';
import { RecordWriter } from '@open-prospector/record';
import { Connection, ProtocolError } from './connection.js';
import { type Inputs, type RunResult } from './index.js';
import { verifyCampaign } from './campaign-audit.js';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
export interface CampaignOptions { output:string; inputs:Inputs; fixtureRoot:string; endpointPath?:string; watchdogMs?:number }
/** Privileged archive composition. The actor below receives only its observer projection. */
export async function runCampaign(options:CampaignOptions):Promise<RunResult> {
  const inputs=clone(options.inputs),{manifest,directive,scenario,fixture}=inputs;
  validate('run-manifest',manifest);validate('directive',directive);validate('scenario',scenario);
  const materialized=validateFixture(fixture);
  for(const kind of ['directive','scenario','fixture'] as const) if(hash(inputs[kind])!==manifest[kind+'_hash']||inputs[kind][kind+'_id']!==manifest[kind+'_id']) throw new Error('Input identity mismatch: '+kind);
  const build=JSON.parse(await readFile(join(repo,'artifacts/build-identity.json'),'utf8')) as ObjectValue;
  if(hash(build.sources)!==build.source_hash||build.source_hash!==(manifest.build as ObjectValue).source_revision)throw new Error('Replay requires archived source identity');
  const output=resolve(options.output);await mkdir(output);
  for(const dir of ['inputs','fixture','schemas','observations','science'])await mkdir(join(output,dir));
  for(const [name,value] of Object.entries(inputs))await writeFile(join(output,'inputs',name+'.json'),canonical(value)+'\n');
  for(const layer of materialized.layers)await writeFile(join(output,'fixture',layer.path),readRasterFile(options.fixtureRoot,layer));
  await writeFile(join(output,'fixture','fixture-manifest.json'),canonical(fixture)+'\n');
  for(const name of (await readdir(join(repo,'packages/contracts/schemas'))).sort())await copyFile(join(repo,'packages/contracts/schemas',name),join(output,'schemas',name));
  await copyFile(join(repo,'artifacts/build-identity.json'),join(output,'build-identity.json'));
  await copyFile(join(repo,'package-lock.json'),join(output,'package-lock.json'));
  await writeFile(join(output,'telemetry.ndjson'),'');
  const runId=String(manifest.run_id),assetId=String(directive.asset_id);
  const projection=projectScenario(scenario,'mission'),actor=projection.scripted_mission_control as ObjectValue;
  const mission=loadMissionFixture(join(output,'fixture'),fixture,runId,assetId);
  const channel=new Channel(runId,manifest.channel as unknown as ChannelProfile,Number((manifest.clock as ObjectValue).start_tick));
  const record=new RecordWriter(join(output,'events.ndjson'),runId);
  let tick=Number((manifest.clock as ObjectValue).start_tick),current=directive,revision=0,terminal='',terminalReason='',state='idle';
  let connection:Connection|undefined,finalStateHash:string|undefined;
  const pending:{tick:number;offer:ObjectValue}[]=[],sourceIds=new Set<string>();
  const submitted=new Map([[String(directive.directive_id),directive]]),receipts=new Set<string>();
  const observations:ObjectValue[]=[],summaries=new Map<string,ObjectValue>(),artifacts=new Map<string,Buffer>();
  const append=(type:string,payload:ObjectValue,who='actor:mission-control',subject=runId)=>record.append({event_type:type,payload,actor_id:who,subject_id:subject,occurred_tick:tick});
  const clearance=(value:ObjectValue)=>{
    const decision=evaluateGatekeeper(value,mission,projection.target_entities as never);
    append('gatekeeper-evaluated',decision as unknown as ObjectValue,'actor:gatekeeper',String(value.directive_id));
    if(!decision.accepted)throw new ProtocolError('gatekeeper:rejected');
  };
  const transmit=(value:ObjectValue,kind:string)=>{
    const message=channel.enqueue({direction:'mission-to-asset',tier:'tier-1',priority:220,sent_tick:tick,payload_kind:kind,payload:value});
    append('directive-transmitted',message as unknown as ObjectValue,'actor:mission-control',String(value.directive_id));
  };
  append('run-started',manifest);
  try {
    append('directive-submitted',directive,String(directive.author_id),String(directive.directive_id));clearance(directive);transmit(directive,'cleared-directive');
    connection=new Connection(options.endpointPath??fileURLToPath(new URL('../../fleet-endpoint/dist/cli.js',import.meta.url)),options.watchdogMs??30_000);
    await connection.request({frame:'init',run_manifest:manifest,scenario,fixture_root:join(output,'fixture')});
    while(!terminal||!channel.empty) {
      if(tick>=100_000)throw new ProtocolError('harness:tick-limit');tick++;
      const due=channel.deliver(tick);
      for(const message of due) {
        await appendFile(join(output,'telemetry.ndjson'),canonical(message)+'\n');
        if(message.direction!=='asset-to-mission')continue;
        mission.receive(message,tick);
        const payload=message.payload;
        const received=(type:string,subject:string)=>record.append({event_type:type,payload,actor_id:assetId,subject_id:subject,occurred_tick:message.sent_tick,received_tick:tick});
        if(message.payload_kind==='endpoint-event') {
          const event=payload as unknown as EndpointEvent;
          if(event.actor_id!==assetId||event.occurred_tick!==message.sent_tick)throw new ProtocolError('protocol:event-context');
          if(event.event_type==='directive-received') {
            const id=String(event.payload.directive_id);
            if(!submitted.has(id)||hash(submitted.get(id))!==hash(event.payload)||receipts.has(id))throw new ProtocolError('protocol:receipt-mismatch');receipts.add(id);
          }
          if(event.event_type==='endpoint-state-changed') {
            if(!receipts.size||terminal||event.payload.from!==state)throw new ProtocolError('protocol:state-context');
            state=String(event.payload.to);
            if(['completed','failed','locked','faulted'].includes(state)){terminal=state;terminalReason=String(event.payload.reason_code);pending.length=0;}
          }
          record.append({...event,received_tick:tick});
        } else if(message.payload_kind==='plan-summary') {
          received('plan-proposed',String(payload.plan_id));
        } else if(message.payload_kind==='contestation') {
          received('contestation-opened',String(payload.contestation_id));
          if(payload.level===2&&!terminal)pending.push({tick:tick+Number(actor.response_delay_ticks),offer:payload});
        } else if(message.payload_kind==='observation-summary') {
          if(summaries.has(String(payload.observation_id)))throw new ProtocolError('evidence:duplicate-summary');
          summaries.set(String(payload.observation_id),payload);received('observation-summarized',String(payload.observation_id));
        } else if(message.payload_kind==='observation') {
          observations.push(payload);await writeFile(join(output,'observations',hash(payload).slice(7)),canonical(payload),{flag:'wx'});
          append('received-belief-updated',{observer_id:'observer:mission-control',observation_id:payload.observation_id!,changed_cell_count:(payload.belief_patch as Json[]).length,belief_state_hash:mission.stateHash()});
        } else if(message.payload_kind==='science-artifact') {
          const ref=payload.reference as ObjectValue,bytes=Buffer.from(String(payload.content_base64),'base64');
          if(hashBytes(bytes)!==ref.artifact_hash||bytes.length!==ref.byte_length)throw new ProtocolError('evidence:artifact-integrity');
          if(!artifacts.has(String(ref.artifact_hash)))await writeFile(join(output,'science',String(ref.artifact_hash).slice(7)),bytes,{flag:'wx'});
          artifacts.set(String(ref.artifact_hash),bytes);
        } else if(message.payload_kind!=='status')throw new ProtocolError('protocol:unsupported-payload');
      }
      for(const action of pending.filter(p=>p.tick===tick)) {
        if(terminal)break;
        const alternative=(action.offer.alternatives as ObjectValue[]).find(a=>a.kind===actor.accept_alternative_kind);
        if(!alternative)throw new ProtocolError('actor:missing-alternative');
        const acceptance={contestation_id:action.offer.contestation_id!,alternative_id:alternative.alternative_id!,accepted_by:current.author_id!,accepted_tick:tick};
        const next=buildAcceptedRevision(current,alternative,acceptance,`directive:accepted-${revision++}`);
        append('alternative-accepted',acceptance,String(current.author_id),String(alternative.alternative_id));
        append('directive-revised',next,String(current.author_id),String(next.directive_id));clearance(next);
        current=next;submitted.set(String(current.directive_id),current);transmit(current,'directive-revision');
      }
      const response=await connection.request({frame:'advance',to_tick:tick,deliveries:due.filter(m=>m.direction==='mission-to-asset') as unknown as Json});
      const ids=new Set<string>();
      for(const intent of response.intents)if(intent.payload_kind==='endpoint-event') {
        const id=String(intent.payload.event_id);if(sourceIds.has(id)||ids.has(id))throw new ProtocolError('protocol:duplicate-source-event');ids.add(id);
      }
      channel.enqueueBatch(response.intents);for(const id of ids)sourceIds.add(id);
    }
    if(terminal!=='completed')throw new ProtocolError('endpoint:'+terminal+':'+terminalReason);
    // The audit reader independently repeats these evidence checks against the persisted bundle.
    for(const observation of observations) {
      const summary=summaries.get(String(observation.observation_id));
      if(!(summary?.artifact_refs as ObjectValue[]|undefined)?.some(r=>r.artifact_hash===hash(observation)&&r.byte_length===Buffer.byteLength(canonical(observation))))throw new ProtocolError('evidence:unbound-observation');
    }
    const final=observations.find(o=>o.observation_type==='standoff-image');
    if(!final||!(final.artifact_refs as ObjectValue[]).length)throw new ProtocolError('evidence:missing-science');
    for(const ref of final.artifact_refs as ObjectValue[])if(!artifacts.has(String(ref.artifact_hash)))throw new ProtocolError('evidence:missing-artifact');
    const checkpoint=await connection.request({frame:'checkpoint',at_tick:tick});finalStateHash=String(checkpoint.frame.state_hash);
    append('checkpoint-created',{at_tick:tick,state_hash:finalStateHash});
    await verifyCampaign(output,{requireCompletion:true});
    await connection.stop();
    append('run-completed',{terminal_state:'completed',final_state_hash:finalStateHash,event_chain_head:record.head!});
  } catch(error) {
    if(connection)await connection.abort();finalStateHash=undefined;
    append('run-failed',{code:error instanceof ProtocolError?error.code:'harness:invariant-failure',detail:error instanceof ProtocolError?error.code:'Run could not be verified; inspect local diagnostics.',safe_state:terminal&&terminal!=='completed'?'hold-position':'not-applicable'});
    await writeFile(join(output,'diagnostics.txt'),String(error)+'\n');
  } finally {record.close();}
  const verification=await verifyCampaign(output);
  await writeFile(join(output,'verification.json'),JSON.stringify({profile:'synthetic-campaign-v0',status:verification.status,head:verification.head,actual_host:{platform:process.platform,architecture:process.arch,node:process.version}},null,2)+'\n');
  return {output,status:verification.status==='completed'?'completed':'failed',head:verification.head,...(finalStateHash?{finalStateHash}:{})};
}
