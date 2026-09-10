import { readFileSync } from 'node:fs';
import { clone, hash, type ObjectValue, type Message, type Intent } from '@open-prospector/contracts';
import { loadAssetFixture, projectScenario, buildAcceptedRevision, evaluateGatekeeper } from '@open-prospector/belief';
import { generateSynthetic, createSensorAdapter } from '@open-prospector/simulation-world';
import { EndpointController, RecordedClassifier, type ControllerConfig, type SensorPort, type ClassifierPort, type ClassifierResult } from '@open-prospector/autonomy';
import { Channel } from '@open-prospector/channel';
export const fixture=JSON.parse(readFileSync('design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json','utf8'));
export const scenario=JSON.parse(readFileSync('design/fixtures/vertical-slice/synthetic-v0.scenario.json','utf8'));
export const directive=JSON.parse(readFileSync('design/fixtures/vertical-slice/directive-v0.json','utf8'));
export function createFixture(options:{directive?:ObjectValue;scenario?:ObjectValue;latency?:number;wrap?:(s:SensorPort)=>SensorPort;classifier?:ClassifierPort;mutateUnsensed?:boolean}={}) {
  const worldScenario=clone(options.scenario??scenario), original=clone(options.directive??directive);
  const layers=generateSynthetic(fixture);
  if(options.mutateUnsensed) { layers.get('truth-obstacles')![100*256+200]=1; worldScenario.hazards.push({hazard_id:'hazard:unsensed',kind:'rock',policy_class:'reflex-if-closed',cells:[{row:100,column:200}],initially_known_to_asset:false,initially_known_to_mission:false}); }
  const projection=projectScenario(worldScenario,'asset');
  const config:ControllerConfig={run_id:'run:controller-test',start_tick:0,round_trip_ticks:(options.latency??3000)*2,original_directive_id:String(original.directive_id),original_directive_hash:hash(original),asset:projection.asset as unknown as ControllerConfig['asset'],targets:projection.target_entities as unknown as ControllerConfig['targets'],hazards:projection.hazards as unknown as ControllerConfig['hazards'],prng_seed_words:[1,2,3,4]};
  const belief=loadAssetFixture('',fixture,config.run_id,config.asset.asset_id,(_root,layer)=>layers.get(layer.name)!);
  const world={cell(row:number,column:number) {const i=row*256+column;return {elevation_mm:layers.get('truth-elevation')!.readInt32LE(i*4),obstacle:layers.get('truth-obstacles')![i]===1,geofence:layers.get('geofence')![i]===1};}};
  const sensors=createSensorAdapter(world,worldScenario);
  const recorded:ClassifierResult[]=[];
  // Explicit test-only probe prepares the exact replay record; production has no fallback.
  const probe:ClassifierPort={consume(state,input) {if(state!=='safe-hold')throw new Error('Probe outside safe hold');const output={model_id:'model:stub-rock-v0',label:'rock' as const,confidence_ppm:900000}; const record={seam_id:'seam:rock-classifier-v0',input_hash:hash(input),output_hash:hash(output),output}; recorded.push(record);return record;},snapshot(){return {probe:true,consumed:recorded.length};}};
  const controller=new EndpointController(config,belief,options.wrap?options.wrap(sensors):sensors,options.classifier??probe);
  const channel=new Channel(config.run_id,{one_way_latency_ticks:options.latency??3000,tier1_bytes_per_tick:4096,tier2_bytes_per_tick:1024},0);
  const message=channel.enqueue({direction:'mission-to-asset',tier:'tier-1',priority:220,sent_tick:0,payload_kind:'cleared-directive',payload:original});
  return {controller,belief,sensors,recorded,channel,message,original,config};
}
export function drive(context:ReturnType<typeof createFixture>,options:{accept?:boolean;maxTick?:number}={}) {
  const {controller,channel}=context; const intents:Intent[]=[]; const delivered:Message[]=[];
  const transitions:ObjectValue[]=[]; const pending:{tick:number;offer:ObjectValue}[]=[];
  let current=context.original, revisionOrdinal=0;
  for(let tick=1;tick<=(options.maxTick??19999);tick++) {
    const due=channel.deliver(tick); delivered.push(...due);
    for(const message of due) if(options.accept!==false&&message.payload_kind==='contestation'&&message.payload.level===2) pending.push({tick:tick+10,offer:message.payload});
    for(const action of pending.filter(p=>p.tick===tick)) {
      const alternative=(action.offer.alternatives as ObjectValue[])[0]!;
      const revision=buildAcceptedRevision(current,alternative,{contestation_id:action.offer.contestation_id!,alternative_id:alternative.alternative_id!,accepted_by:current.author_id!,accepted_tick:tick},`directive:accepted-${revisionOrdinal++}`);
      if(!evaluateGatekeeper(revision,context.belief,context.config.targets).accepted) throw new Error('Gatekeeper rejected accepted test revision');
      channel.enqueue({direction:'mission-to-asset',tier:'tier-1',priority:220,sent_tick:tick,payload_kind:'directive-revision',payload:revision}); current=revision;
    }
    const emitted=controller.advance(tick,due.filter(m=>m.direction==='mission-to-asset')); intents.push(...emitted);
    for(const intent of emitted) {channel.enqueue(intent);if(intent.payload_kind==='endpoint-event'&&intent.payload.event_type==='endpoint-state-changed')transitions.push(intent.payload.payload as ObjectValue);}
    if(['completed','failed','faulted','locked'].includes(controller.state)) return {intents,delivered,transitions,checkpoint:controller.checkpoint(),recorded:context.recorded};
  }
  return {intents,delivered,transitions,checkpoint:controller.checkpoint(),recorded:context.recorded};
}
export function replayedFixture(records:ClassifierResult[],options:Parameters<typeof createFixture>[0]={}) { return createFixture({...options,classifier:new RecordedClassifier(records)}); }
