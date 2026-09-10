import { canonical, clone, expandAdvisory, hash, validate, type Intent, type Message, type ObjectValue } from '@open-prospector/contracts';
import { add, identifier, reflexWindow, unsigned } from '@open-prospector/deterministic';
import { evaluateGatekeeper, validateAcceptedRevision, type AssetBelief, type Cell } from '@open-prospector/belief';
import { LineageBudget, BudgetExceeded, ReserveExceeded } from './budget.js';
import { EdgeMotion, type EdgePose } from './motion.js';
import { planDirective, proposeAlternatives, type KnownTarget, type ScheduledRoute } from './alternatives.js';
import { edgeEstimate, standoffEligible, planRoute, estimateRoute, type Envelope, type Route } from './planner.js';
import { transition, isTerminal, type State, type ControllerEvent } from './state.js';
import type { ClassifierInput, ClassifierResult } from './classifier.js';

export interface HazardView { hazard_id: string; kind: string; policy_class: string; cells: Cell[] }
export interface SampleMetadata { run_id: string; asset_id: string; observation_id: string; observed_tick: number }
export interface ControllerSample { observation: ObjectValue; discovered_hazards: HazardView[]; contact: {cell:Cell;distance_mm:number}|null }
export interface SensorPort {
  sweep(cell:Cell,metadata:SampleMetadata):ControllerSample;
  obstacleRange(pose:EdgePose,path:readonly Cell[],metadata:SampleMetadata):ControllerSample|null;
  standoff(cell:Cell,target:{cell:Cell;entity_id?:string},metadata:SampleMetadata):ObjectValue;
}
export interface ClassifierPort { consume(state:State,input:ClassifierInput):ClassifierResult; snapshot():unknown }
export interface ControllerConfig {
  run_id:string; start_tick:number; round_trip_ticks:number; original_directive_id:string; original_directive_hash:string;
  asset:{asset_id:string;start_cell:Cell;starting_energy_units:number}; targets:KnownTarget[]; hazards:HazardView[];
  prng_seed_words:number[];
}
const same=(a:Cell,b:Cell)=>a.row===b.row&&a.column===b.column;
const cellKey=(cell:Cell)=>`${cell.row},${cell.column}`;

/** No world, full scenario, channel queue, filesystem or model provider is available here. */
export class EndpointController {
  readonly #config:ControllerConfig;
  readonly #belief:AssetBelief;
  readonly #sensors:SensorPort;
  readonly #classifier:ClassifierPort;
  readonly #motion:EdgeMotion;
  #state:State='idle'; #tick:number;
  #directive:ObjectValue|null=null; #budget:LineageBudget|null=null;
  #plan:ScheduledRoute|null=null; #planId:string|null=null; #next=1;
  #offer:ObjectValue|null=null; #lastEvidence:ObjectValue|null=null;
  #pendingClassifier:ClassifierInput|null=null; #classifierUsed=false;
  #hazards=new Map<string,HazardView>(); #ordinals:Record<string,number>={}; #seen=new Set<string>(); #out:Intent[]=[];
  constructor(config:ControllerConfig,belief:AssetBelief,sensors:SensorPort,classifier:ClassifierPort) {
    validate('common#/$defs/Id',config.run_id); validate('common#/$defs/Id',config.asset.asset_id);
    validate('common#/$defs/Id',config.original_directive_id); validate('common#/$defs/Hash',config.original_directive_hash);
    unsigned(config.start_tick); unsigned(config.round_trip_ticks); unsigned(config.asset.starting_energy_units);
    if(config.prng_seed_words.length!==4||config.prng_seed_words.some(v=>!Number.isInteger(v)||v<0||v>4294967295)||config.prng_seed_words.every(v=>v===0)) throw new Error('Invalid deterministic seed');
    this.#config=clone(config); this.#tick=config.start_tick; this.#belief=belief; this.#sensors=sensors; this.#classifier=classifier;
    this.#motion=new EdgeMotion(config.asset.start_cell);
    for(const hazard of config.hazards) this.#hazards.set(hazard.hazard_id,clone(hazard));
  }
  get state():State { return this.#state; }
  get tick():number { return this.#tick; }
  #id(kind:string):string { const ordinal=this.#ordinals[kind]??0; this.#ordinals[kind]=add(ordinal,1); return identifier(this.#config.run_id,kind,this.#tick,ordinal); }
  #intent(payload_kind:string,payload:ObjectValue,tier:'tier-1'|'tier-2'='tier-1',priority=230) {
    const value:Intent={direction:'asset-to-mission',tier,priority,sent_tick:this.#tick,payload_kind,payload:clone(payload)};
    validate('outbound-intent',value); this.#out.push(value);
  }
  #event(event_type:string,payload:ObjectValue,subject=String(this.#directive?.directive_id??this.#config.asset.asset_id)):string {
    const event_id=this.#id('endpoint-event');
    this.#intent('endpoint-event',{event_id,occurred_tick:this.#tick,actor_id:this.#config.asset.asset_id,subject_id:subject,event_type,payload}); return event_id;
  }
  #usage():ObjectValue {
    return this.#budget ? {...this.#budget.snapshot(this.#tick).usage} : {duration_ticks:0,traverse_mm:0,energy_units:0,tier2_bytes:0};
  }
  #transition(event:ControllerEvent,cause:string,reason:string) {
    const next=transition(this.#state,event);
    this.#event('endpoint-state-changed',{asset_id:this.#config.asset.asset_id,from:this.#state,to:next,cause_id:cause,reason_code:reason,budget_used:this.#usage()});
    this.#state=next;
    if(isTerminal(next)) {
      if(this.#budget&&!this.#budget.snapshot(this.#tick).terminal) this.#budget.finish(this.#tick);
    }
  }
  #metadata():SampleMetadata { return {run_id:this.#config.run_id,asset_id:this.#config.asset.asset_id,observation_id:this.#id('observation'),observed_tick:this.#tick}; }
  #reference(observation:ObjectValue):ObjectValue {
    return {artifact_id:`artifact:${String(observation.observation_id).slice('observation:'.length)}`,artifact_hash:hash(observation),media_type:'application/vnd.openprospector.observation+json',byte_length:Buffer.byteLength(canonical(observation))};
  }
  #apply(sample:ControllerSample) {
    validate('observation',sample.observation);
    const footprint=new Set((sample.observation.footprint_cells as unknown as Cell[]).map(cellKey));
    if(sample.contact) {
      unsigned(sample.contact.distance_mm);
      if(!footprint.has(cellKey(sample.contact.cell)) || !(sample.observation.belief_patch as ObjectValue[]).some(p=>same(p.cell as unknown as Cell,sample.contact!.cell)&&p.obstacle===true)) throw new Error('Contact outside sensed obstacle patch');
    }
    const updates=new Map(this.#hazards);
    for(const hazard of sample.discovered_hazards) {
      validate('common#/$defs/Id',hazard.hazard_id);
      if(!['slump','rock','no-go-zone'].includes(hazard.kind)||!['significant-if-open','reflex-if-closed','gatekeeper'].includes(hazard.policy_class)) throw new Error('Invalid hazard metadata');
      if(hazard.cells.some(cell=>!footprint.has(cellKey(cell)))) throw new Error('Hazard metadata outside observation footprint');
      const prior=this.#hazards.get(hazard.hazard_id);
      if(prior&&(prior.kind!==hazard.kind||prior.policy_class!==hazard.policy_class)) throw new Error('Hazard identity changed');
      const cells=new Map([...(prior?.cells??[]),...hazard.cells].map(cell=>[cellKey(cell),{...cell}]));
      updates.set(hazard.hazard_id,{hazard_id:hazard.hazard_id,kind:hazard.kind,policy_class:hazard.policy_class,cells:[...cells.values()].sort((a,b)=>a.row-b.row||a.column-b.column)});
    }
    this.#belief.observe(sample.observation,this.#tick); this.#hazards=updates;
    this.#lastEvidence=this.#reference(sample.observation);
  }
  #publish(observation:ObjectValue) {
    this.#budget!.reserveTier2(this.#tick,'observation',observation);
    const patches=observation.belief_patch as ObjectValue[];
    const ordered=(cells:Cell[])=>cells.map(cell=>({...cell})).sort((a,b)=>a.row-b.row||a.column-b.column);
    this.#intent('observation-summary',{observation_id:observation.observation_id!,observation_type:observation.observation_type!,observed_tick:observation.observed_tick!,footprint_hash:hash(ordered(observation.footprint_cells as unknown as Cell[])),changed_cell_count:patches.length,
      hazard_cells:ordered(patches.filter(p=>p.obstacle===true).map(p=>p.cell as unknown as Cell)).slice(0,16),artifact_refs:[...(observation.artifact_refs as ObjectValue[]??[]),this.#reference(observation)]},'tier-1',180);
    this.#intent('observation',observation,'tier-2',160);
  }
  #sweep() {
    this.#budget!.checkTime(this.#tick);
    const sample=this.#sensors.sweep(this.#motion.occupancy(),this.#metadata()); this.#apply(sample); this.#publish(sample.observation);
  }
  #context() { return {current_cell:this.#motion.occupancy(),current_tick:this.#tick,budget:this.#budget!.snapshot(this.#tick),targets:this.#config.targets}; }
  #target():{cell:Cell;entity_id?:string} {
    const target=this.#directive!.target as ObjectValue;
    if(target.kind==='cell') return {cell:clone(target.cell) as unknown as Cell};
    const known=this.#config.targets.find(value=>value.entity_id===target.entity_id);
    if(!known) throw new Error('Unknown science target'); return {cell:{...known.cell},entity_id:known.entity_id};
  }
  #makePlan(recovery:boolean):boolean {
    const plan=planDirective(this.#belief,this.#directive,this.#context());
    if(!plan) {
      const budget=this.#budget!.snapshot(this.#tick);
      const route=planRoute(this.#belief,{start:this.#motion.occupancy(),goal:(this.#directive!.observation_cell as unknown as Cell|undefined)??this.#target().cell,envelope:this.#directive!.operating_envelope as unknown as Envelope,
        limits:{traverse_mm:Number.MAX_SAFE_INTEGER,duration_ticks:Number.MAX_SAFE_INTEGER,energy_units:budget.available_energy_units}});
      if(route) this.#routeBudgetFailure(route);
      return false;
    }
    this.#plan=plan; this.#next=1; this.#planId=this.#id('plan');
    this.#intent('plan-summary',{plan_id:this.#planId,directive_id:this.#directive!.directive_id!,route:plan.route.cells.map(cell=>({...cell})),distance_mm:plan.route.traverse_mm,energy_units:plan.route.energy_units,planned_start_tick:plan.planned_start_tick,
      planned_complete_tick:add(plan.planned_start_tick,Math.max(0,plan.route.duration_ticks-1))},'tier-1',200);
    this.#transition(recovery?'safe-replan':'safe-plan',recovery?this.#planId:String(this.#directive!.directive_id),recovery?'safe-local-replan':'safe-plan'); return true;
  }
  #routeBudgetFailure(route:Route) {
    const snapshot=this.#budget!.snapshot(this.#tick), wait=Math.max(add(this.#tick,1),Number(this.#directive!.earliest_start_tick))-this.#tick;
    const counter=route.duration_ticks+wait>snapshot.remaining.duration_ticks?'duration_ticks':route.traverse_mm>snapshot.remaining.traverse_mm?'traverse_mm':route.energy_units>snapshot.remaining.energy_units?'energy_units':null;
    if(counter) throw new BudgetExceeded(counter,snapshot.usage);
  }
  #contest(hazardId:string,contact?:{distance_mm:number}) {
    if(!this.#lastEvidence) throw new Error('Contestation requires observation evidence');
    const window=contact?reflexWindow(contact.distance_mm,100,this.#config.round_trip_ticks):null;
    if(contact&&contact.distance_mm<0) throw new Error('Obstacle contact already occurred');
    const id=this.#id('contestation'), reflex=window&&!window.window_open;
    const first=this.#ordinals.alternative??0;
    const alternatives=reflex?[]:proposeAlternatives(this.#belief,this.#directive,this.#context(),{run_id:this.#config.run_id,contestation_id:id,hazard_id:hazardId,first_ordinal:first});
    if(!reflex&&!alternatives.length) {
      const context=this.#context(), unlimited={...context.budget,remaining:{...context.budget.remaining,traverse_mm:Number.MAX_SAFE_INTEGER,duration_ticks:Number.MAX_SAFE_INTEGER,energy_units:context.budget.available_energy_units}};
      const possible=proposeAlternatives(this.#belief,this.#directive,{...context,budget:unlimited},{run_id:this.#config.run_id,contestation_id:id,hazard_id:hazardId,first_ordinal:first});
      if(possible.length) this.#routeBudgetFailure(estimateRoute(this.#belief,possible[0]!.proposed_route as unknown as Cell[]));
    }
    this.#ordinals.alternative=add(first,alternatives.length);
    const level=reflex?0:alternatives.length?2:3;
    const value:ObjectValue={schema_version:'contestation-v0',contestation_id:id,directive_id:this.#directive!.directive_id!,preserved_goal_id:(this.#directive!.goal as ObjectValue).goal_id!,asset_id:this.#config.asset.asset_id,autonomy_version:'autonomy.slice-v0',hazard_id:hazardId,hazard_class:contact?'obstacle':'terrain',evidence:[this.#lastEvidence],confidence_ppm:1000000,severity:level===0?'reflex':level===2?'significant':'critical',level,
      round_trip_ticks:this.#config.round_trip_ticks,time_to_harm_ticks:window?.T??null,window_open:window?.window_open??true,alternative_ids:alternatives.map(a=>a.alternative_id!),alternatives,disposition:level===0?'safe-hold':level===2?'holding':'locked',created_tick:this.#tick,
      ...(reflex?{reflex_inputs:{distance_mm:contact!.distance_mm,speed_mm_per_tick:100,reaction_ticks:1,braking_mm_per_tick2:25,stopping_distance_mm:window!.stopping_distance_mm}}:{})};
    validate('contestation',value); this.#intent('contestation',value,'tier-1',240);
    if(level===0) this.#motion.abandon(); this.#plan=null;
    this.#offer=level===2?clone(value):null;
    this.#transition(level===0?'reflex':level===2?'alternatives':'critical',id,level===0?'window-shut':level===2?'safe-permitted-alternatives':'no-safe-permitted-alternative');
  }
  #receive(message:Message) {
    if(isTerminal(this.#state)) { this.#intent('status',{asset_id:this.#config.asset.asset_id,from:this.#state,to:this.#state,reason_code:'ignored-terminal',occurred_tick:this.#tick}); return; }
    const directive=message.payload;
    if(directive.asset_id!==this.#config.asset.asset_id) throw new Error('Wrong directive asset');
    if(!this.#directive) {
      if(message.payload_kind!=='cleared-directive'||directive.directive_id!==this.#config.original_directive_id||hash(directive)!==this.#config.original_directive_hash) throw new Error('Original directive identity mismatch');
      if(!evaluateGatekeeper(directive,this.#belief,this.#config.targets).accepted) throw new Error('Gatekeeper rejected cleared directive');
      this.#budget=new LineageBudget(directive,message.sent_tick,this.#config.asset.starting_energy_units); this.#directive=clone(directive);
      this.#event('directive-received',this.#directive); this.#transition('directive-delivered',String(directive.directive_id),'cleared-directive');
    } else {
      if(this.#state!=='holding'||message.payload_kind!=='directive-revision') throw new Error('Revision not permitted in current state');
      if(!evaluateGatekeeper(directive,this.#belief,this.#config.targets).accepted) throw new Error('Gatekeeper rejected revision');
      if(directive.accepted_alternative) validateAcceptedRevision(this.#directive,directive,this.#offer,message.sent_tick);
      this.#budget!.revise(directive,message.sent_tick); this.#directive=clone(directive);
      this.#motion.abandon();
      this.#event('directive-received',this.#directive); this.#transition(directive.accepted_alternative?'accepted-revision':'supersession',String(directive.directive_id),directive.accepted_alternative?'accepted-offered-alternative':'linked-supersession');
      this.#offer=null;
    }
  }
  #complete() {
    const target=this.#target();
    if(!standoffEligible(this.#belief,this.#motion.occupancy(),target.cell)) { this.#contest('hazard:science-geometry'); return; }
    const observation=this.#sensors.standoff(this.#motion.occupancy(),target,this.#metadata()); validate('observation',observation);
    if(observation.observation_type!=='standoff-image') throw new Error('Expected standoff evidence');
    const measurements=observation.measurements as ObjectValue[];
    if(new Set(measurements.map(m=>m.name)).size!==measurements.length) throw new Error('Duplicate science measurement');
    for(const [name,unit] of [['target_range_mm','mm'],['line_of_sight','boolean'],['spectral_class','class']]) if(measurements.find(m=>m.name===name)?.unit!==unit) throw new Error('Missing or invalid science measurement');
    this.#belief.observe(observation,this.#tick);
    const values=new Map(measurements.map(item=>[String(item.name),item.value]));
    const occupied=this.#belief.cell(this.#motion.occupancy());
    const satisfied:Record<string,boolean>={
      'standoff-image':Number.isSafeInteger(values.get('target_range_mm'))&&Number(values.get('target_range_mm'))>=0&&Number(values.get('target_range_mm'))<=20000&&values.get('line_of_sight')===true,
      'spectral-characterization':typeof values.get('spectral_class')==='string'&&values.get('spectral_class')!=='indeterminate',
      'position-safe':!occupied.obstacle&&!occupied.geofence,
      'energy-reserve-met':this.#budget!.snapshot(this.#tick).available_energy_units>=0
    };
    if(!(this.#directive!.goal as ObjectValue).success_evidence || ((this.#directive!.goal as ObjectValue).success_evidence as string[]).some(item=>!satisfied[item])) throw new Error('Mandatory science evidence unsatisfied');
    const bytes=Buffer.from(canonical(measurements));
    const reference:ObjectValue={artifact_id:this.#id('artifact'),artifact_hash:hash(measurements),media_type:'application/json',byte_length:bytes.length};
    observation.artifact_refs=[reference];
    this.#publish(observation);
    const artifact={reference,content_base64:bytes.toString('base64')}; this.#budget!.reserveTier2(this.#tick,'science-artifact',artifact); this.#intent('science-artifact',artifact,'tier-2',100);
    this.#transition('success',String(observation.observation_id),'mandatory-evidence-enqueued');
  }
  #work() {
    if(!this.#budget||isTerminal(this.#state)) return;
    this.#budget.checkTime(this.#tick);
    if(this.#state==='planning') {
      this.#sweep();
      const advisory=expandAdvisory((this.#directive!.advisory_route??[]) as unknown as Cell[]);
      const significant=[...this.#hazards.values()].filter(h=>h.policy_class==='significant-if-open').sort((a,b)=>a.hazard_id<b.hazard_id?-1:1).find(h=>h.cells.some(cell=>advisory.some(p=>same(p,cell))));
      if(significant) this.#contest(significant.hazard_id);
      else if(!this.#makePlan(false)) this.#contest('hazard:unreachable-goal');
      return;
    }
    if(this.#state==='safe-hold') {
      if(this.#pendingClassifier) {
        const input=this.#pendingClassifier;
        const result=this.#classifier.consume(this.#state,input); validate('protocol-payload#/$defs/ClassifierResult',result);
        if(result.input_hash!==hash(input)||result.output_hash!==hash(result.output)) throw new Error('Classifier record mismatch');
        this.#event('classifier-result-consumed',result,input.observation_id); this.#pendingClassifier=null; this.#classifierUsed=true;
      }
      if(!this.#makePlan(true)) this.#contest('hazard:no-safe-recovery'); return;
    }
    if(this.#state==='scheduled'&&this.#tick>=this.#plan!.planned_start_tick) this.#transition('start',this.#planId!,'execution-started');
    if(this.#state!=='executing'||this.#tick<this.#plan!.planned_start_tick) return;
    const route=this.#plan!.route.cells;
    if(this.#next>=route.length) { this.#complete(); return; }
    const pose=this.#motion.pose(); if(same(pose.from_cell,pose.to_cell)) this.#motion.start(route[this.#next]!,edgeEstimate(this.#belief,this.#motion.occupancy(),route[this.#next]!));
    const sample=this.#sensors.obstacleRange(this.#motion.pose(),route.slice(this.#next-1),this.#metadata());
    if(sample) {
      this.#apply(sample);
      if(sample.contact) {
        const hazard=sample.discovered_hazards.find(h=>h.cells.some(cell=>same(cell,sample.contact!.cell)));
        const open=reflexWindow(sample.contact.distance_mm,100,this.#config.round_trip_ticks).window_open;
        if(open) this.#publish(sample.observation);
        this.#contest(hazard?.hazard_id??'hazard:runtime-obstacle',sample.contact);
        if(!open&&!isTerminal(this.#state)) this.#publish(sample.observation);
        if(this.state==='safe-hold') {
          if(!this.#classifierUsed) this.#pendingClassifier={observation_id:String(sample.observation.observation_id),sensor_id:String(sample.observation.sensor_id),artifact_hash:hash(sample.observation)};
          this.#sweep();
        }
        return;
      }
      this.#publish(sample.observation);
    }
    this.#motion.step(this.#tick,this.#budget);
    if(same(this.#motion.occupancy(),route[this.#next]!)) this.#next++;
    if(this.#next===route.length) this.#complete();
  }
  advance(toTick:number,deliveries:readonly Message[]):Intent[] {
    if(toTick!==add(this.#tick,1)) throw new Error('Nonconsecutive controller tick'); this.#tick=toTick; this.#out=[];
    try {
      if(this.#budget&&!isTerminal(this.#state)) this.#budget.checkTime(toTick);
      let ordinal=-1; const batch=new Set<string>();
      for(const message of deliveries) {
        validate('channel-message',message);
        if(message.run_id!==this.#config.run_id||message.direction!=='mission-to-asset'||message.deliver_at_tick!==toTick||message.sent_tick>toTick||this.#seen.has(message.message_id)||batch.has(message.message_id)||message.creation_ordinal<=ordinal) throw new Error('Invalid delivery context');
        if(!['cleared-directive','directive-revision'].includes(message.payload_kind)) throw new Error('Unsupported endpoint command');
        batch.add(message.message_id); ordinal=message.creation_ordinal;
      }
      for(const message of deliveries) { this.#seen.add(message.message_id); this.#receive(message); }
      this.#work();
    } catch(error) {
      if(isTerminal(this.#state)) throw error;
      if(error instanceof BudgetExceeded) this.#transition('budget-failure',String(this.#directive!.directive_id),error.message);
      else if(error instanceof ReserveExceeded&&this.#lastEvidence&&['planning','executing','safe-hold'].includes(this.#state)) this.#contest('hazard:energy-reserve');
      else {
        const id=this.#event('endpoint-fault',{code:'controller-invariant',detail:error instanceof Error?error.message.slice(0,1024):'Controller invariant failed',safe_state:'hold-position'});
        this.#transition('fault',id,'controller-invariant');
      }
    }
    return clone(this.#out);
  }
  checkpoint():ObjectValue {
    return clone({profile:'endpoint-controller-v0',tick:this.#tick,state:this.#state,directive:this.#directive,pose:this.#motion.pose(),budget:this.#budget?this.#budget.snapshot(this.#tick):null,prng:{algorithm:'xoshiro128ss-v1',state:this.#config.prng_seed_words,draw_count:0},
      plan:this.#plan,plan_id:this.#planId,next_cell_index:this.#next,belief_hash:this.#belief.stateHash(),hazards:[...this.#hazards.values()].sort((a,b)=>a.hazard_id<b.hazard_id?-1:1),ordinals:this.#ordinals,
      offered:this.#offer,last_evidence:this.#lastEvidence,pending_classifier:this.#pendingClassifier,classifier_used:this.#classifierUsed,classifier:this.#classifier.snapshot(),received_message_ids:[...this.#seen].sort()}) as unknown as ObjectValue;
  }
}
