import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bresenham, canonical, cellCenter, clone, expandAdvisory } from '@open-prospector/contracts';
import { loadAssetFixture, projectScenario, type BeliefCell, type Cell } from '@open-prospector/belief';
import { createSensorAdapter, generateSynthetic } from '@open-prospector/simulation-world';
import { edgeEstimate, estimateRoute, LineageBudget, lineOfSight, standoffEligible, planDirective, planRoute, proposeAlternatives, type KnownTarget, type Terrain } from '@open-prospector/autonomy';

const normal: BeliefCell = { known: true, obstacle: false, elevation_mm: 0, uncertainty_mm: 0, geofence: false, sensed: false };
const terrain = (cells: Record<string, Partial<BeliefCell>> = {}): Terrain => ({ cell: cell => ({ ...normal, ...cells[`${cell.row},${cell.column}`] }) });
const limits = { traverse_mm: 200000, energy_units: 40000, duration_ticks: 2000 };
const envelope = { min_row: 0, max_row: 4, min_column: 0, max_column: 4 };
const fixture = JSON.parse(readFileSync('design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json', 'utf8'));
const scenario = JSON.parse(readFileSync('design/fixtures/vertical-slice/synthetic-v0.scenario.json', 'utf8'));
const directive = JSON.parse(readFileSync('design/fixtures/vertical-slice/directive-v0.json', 'utf8'));
const from = { row: 2, column: 2 }, to = { row: 0, column: 1 };

test('Bresenham saved-error ties, reverse octants, waypoint expansion and cell centres are frozen', () => {
  assert.deepEqual(bresenham({ row: 0, column: 0 }, { row: 1, column: 2 }), [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 }]);
  assert.deepEqual(bresenham({ row: 1, column: 2 }, { row: 0, column: 0 }), [{ row: 1, column: 2 }, { row: 0, column: 1 }, { row: 0, column: 0 }]);
  assert.deepEqual(expandAdvisory([{ row: 0, column: 0 }, { row: 0, column: 2 }, { row: 2, column: 2 }]), [ {row:0,column:0}, {row:0,column:1}, {row:0,column:2}, {row:1,column:2}, {row:2,column:2} ]);
  assert.deepEqual(cellCenter({ row: 0, column: 0 }), { e_mm: 500, n_mm: 255500 });
  assert.deepEqual(cellCenter({ row: 255, column: 255 }), { e_mm: 255500, n_mm: 500 });
  for (const [dr,dc] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) {
    assert.deepEqual(bresenham({row:3,column:3},{row:3+dr!,column:3+dc!}),[{row:3,column:3},{row:3+Math.sign(dr!),column:3+Math.sign(dc!)},{row:3+dr!,column:3+dc!}]);
  }
});

test('A* chooses higher g on f ties and then ascending row/column', () => {
  assert.deepEqual(planRoute(terrain(), { start: from, goal: to, envelope, limits })?.cells, [from, { row: 1, column: 1 }, to]);
  const symmetric = terrain({ '2,2': { obstacle: true } });
  const route = planRoute(symmetric, { start: { row: 2, column: 0 }, goal: { row: 2, column: 4 }, envelope, limits });
  assert.deepEqual(route?.cells, [{row:2,column:0},{row:1,column:1},{row:1,column:2},{row:1,column:3},{row:2,column:4}]);
});

test('unknown and slope thresholds change costs/energy; uncertainty does not', () => {
  const a = {row:0,column:0}, b = {row:0,column:1};
  for (const [rise, cost, blocked, energy] of [[250,1000,false,125],[251,4000,false,126],[350,4000,false,135],[351,4000,true,136]] as const) {
    const edge = edgeEstimate(terrain({'0,1':{elevation_mm:rise}}),a,b);
    assert.equal(edge.cost,cost); assert.equal(edge.blocked,blocked); assert.equal(edge.energy_units,energy);
  }
  assert.equal(edgeEstimate(terrain({'0,1':{elevation_mm:-350}}),a,b).energy_units,100);
  const edge = edgeEstimate(terrain({'0,0':{known:false},'0,1':{elevation_mm:2147483647}}),a,b);
  assert.deepEqual(edge, {length_mm:1000,energy_units:100,cost:6000,duration_ticks:10,blocked:false});
  const known = planRoute(terrain(),{start:from,goal:to,envelope,limits});
  assert.deepEqual(planRoute(terrain({'1,1':{uncertainty_mm:4294967295}}),{start:from,goal:to,envelope,limits}),known);
  assert.deepEqual(planRoute(terrain({'1,1':{known:false}}),{start:from,goal:to,envelope,limits})?.cells,[from,{row:1,column:2},to]);
});

test('blocked corners, no-go cells and envelope cannot be bypassed', () => {
  const small = {min_row:0,max_row:1,min_column:0,max_column:1};
  for (const block of [{obstacle:true},{geofence:true}]) assert.equal(planRoute(terrain({'0,1':block,'1,0':block}),{start:{row:0,column:0},goal:{row:1,column:1},envelope:small,limits}),null);
  assert.equal(planRoute(terrain(),{start:from,goal:to,envelope:small,limits}),null);
  assert.throws(()=>planRoute(terrain(),{start:from,goal:to,envelope:{...envelope,min_row:5},limits}));
});

test('resource equality admits routes; one below excludes them', () => {
  const target = {row:1,column:1};
  const request = {start:from,goal:target,envelope,limits:{traverse_mm:1414,energy_units:142,duration_ticks:15}};
  assert.equal(planRoute(terrain(),request)?.cost,1414);
  for (const counter of ['traverse_mm','energy_units','duration_ticks'] as const) assert.equal(planRoute(terrain(),{...request,limits:{...request.limits,[counter]:request.limits[counter]-1}}),null);
});

test('resource-aware search preserves an affordable route despite a cheaper energetic prefix', () => {
  // Four nominal climbs: shortest route spends900; the longer flat route spends884.
  const map = terrain({'1,1':{elevation_mm:250},'1,3':{elevation_mm:250},'1,5':{elevation_mm:250},'1,7':{elevation_mm:250}});
  const request = {start:{row:1,column:0},goal:{row:1,column:8},envelope:{min_row:1,max_row:2,min_column:0,max_column:8},limits:{...limits,energy_units:890}};
  const cheapest = planRoute(map,{...request,limits});
  assert.equal(cheapest?.cost,8000); assert.equal(cheapest?.energy_units,900);
  const route = planRoute(map,request);
  assert.ok(route); assert.ok(route.energy_units<=890); assert.ok(route.cost>8000);
});

test('standoff uses inclusive20m Euclidean range, known target and visibility', () => {
  const start={row:20,column:20};
  assert.equal(standoffEligible(terrain(),start,{row:20,column:40}),true);
  assert.equal(standoffEligible(terrain(),start,{row:32,column:36}),true);
  assert.equal(standoffEligible(terrain(),start,{row:21,column:40}),false);
  assert.equal(standoffEligible(terrain({'20,40':{known:false}}),start,{row:20,column:40}),false);
  assert.equal(standoffEligible(terrain({'20,30':{obstacle:true}}),start,{row:20,column:40}),false);
});

test('line of sight ignores endpoints and blocks intermediate obstacles only', () => {
  const a={row:0,column:0}, b={row:2,column:2};
  assert.equal(lineOfSight(terrain({'0,0':{obstacle:true},'2,2':{obstacle:true},'1,1':{geofence:true,elevation_mm:20000}}),a,b),true);
  assert.equal(lineOfSight(terrain({'1,1':{obstacle:true}}),a,b),false);
});

function synthetic() {
  const layers = generateSynthetic(fixture);
  const asset = loadAssetFixture('',fixture,'run:test',scenario.asset.asset_id,(_root,layer)=>layers.get(layer.name)!);
  const world = { cell(row:number,column:number) { const i=row*256+column; return { elevation_mm:layers.get('truth-elevation')!.readInt32LE(i*4),obstacle:layers.get('truth-obstacles')![i]===1,geofence:layers.get('geofence')![i]===1 }; } };
  const sensors = createSensorAdapter(world,scenario);
  const sample=sensors.sweep(scenario.asset.start_cell,{run_id:'run:test',asset_id:scenario.asset.asset_id,observation_id:'observation:sweep',observed_tick:10});
  asset.observe(sample.observation,10);
  const budget=new LineageBudget(directive,0,50000);
  const targets=projectScenario(scenario,'asset').target_entities as unknown as KnownTarget[];
  return {asset,budget,targets,layers,sample};
}
test('synthetic alternatives select frozen vantage and target; vantage route crosses hidden rock', () => {
  const {asset,budget,targets}=synthetic();
  const context={current_cell:scenario.asset.start_cell,current_tick:10,budget:budget.snapshot(10),targets};
  const identity={run_id:'run:test',contestation_id:'contestation:test',hazard_id:'hazard:slump-v0',first_ordinal:0};
  const alternatives=proposeAlternatives(asset,directive,context,identity);
  assert.equal(alternatives.length,2);
  assert.deepEqual(alternatives[0]!.proposed_cell,{row:180,column:70});
  assert.deepEqual(alternatives[1]!.proposed_cell,{row:185,column:95});
  assert.ok((alternatives[0]!.proposed_route as unknown as Cell[]).some(c=>c.row===205&&c.column===45));
  assert.equal(asset.cell({row:205,column:45}).obstacle,false);
  assert.equal(canonical(proposeAlternatives(asset,directive,{...context,targets:[...targets].reverse()},identity)),canonical(alternatives));
  const baseline=estimateRoute(asset,expandAdvisory(directive.advisory_route));
  const candidate=estimateRoute(asset,alternatives[0]!.proposed_route as unknown as Cell[]);
  assert.deepEqual(alternatives[0]!.budget_delta,{duration_ticks:candidate.duration_ticks-baseline.duration_ticks,traverse_mm:candidate.traverse_mm-baseline.traverse_mm,energy_units:candidate.energy_units-baseline.energy_units,tier2_bytes:0});
  assert.deepEqual(alternatives[0]!.budget_delta,{duration_ticks:-100,traverse_mm:-10000,energy_units:-1010,tier2_bytes:0});
  assert.deepEqual(alternatives[1]!.budget_delta,{duration_ticks:125,traverse_mm:12930,energy_units:1310,tier2_bytes:0});
});

test('directive planning applies reserve, waiting time and preserved lineage usage', () => {
  const input=clone(directive); input.target={kind:'cell',cell:{row:220,column:31}}; input.earliest_start_tick=10; input.deadline_tick=20;
  const budget=new LineageBudget(input,0,125); // exactly100 usable energy
  const context={current_cell:{row:220,column:30},current_tick:0,budget:budget.snapshot(0),targets:[]};
  assert.equal(planDirective(terrain(),input,context)?.planned_start_tick,10); // ten motion ticks10..19
  input.deadline_tick=19;
  const earlier=new LineageBudget(input,0,125);
  assert.equal(planDirective(terrain(),input,{...context,budget:earlier.snapshot(0)}),null);
  input.deadline_tick=20;
  const depleted=new LineageBudget(input,0,125); depleted.debit(0,{energy_units:1});
  assert.equal(planDirective(terrain(),input,{...context,budget:depleted.snapshot(0)}),null);
});

test('target proposals obey permission, known class, envelope, no-go and ID ties', () => {
  const input=clone(directive); input.operating_envelope=envelope; input.permitted_substitutions=['target']; delete input.advisory_route;
  const targets:KnownTarget[]=[{entity_id:'target:hydrated-primary',cell:{row:2,column:2},science_class:'mineral'},
    {entity_id:'target:zeta',cell:{row:3,column:3},science_class:'mineral'},
    {entity_id:'target:alpha',cell:{row:3,column:1},science_class:'mineral'},
    {entity_id:'target:wrong-class',cell:{row:4,column:2},science_class:'other'},
    {entity_id:'target:outside',cell:{row:5,column:2},science_class:'mineral'}];
  const context={current_cell:{row:4,column:2},current_tick:1,budget:new LineageBudget(input,0,50000).snapshot(1),targets};
  const id={run_id:'run:test',contestation_id:'contestation:test',hazard_id:'hazard:test',first_ordinal:0};
  assert.equal(proposeAlternatives(terrain(),input,context,id)[0]!.proposed_entity_id,'target:alpha');
  assert.equal(proposeAlternatives(terrain({'3,1':{geofence:true}}),input,context,id)[0]!.proposed_entity_id,'target:zeta');
  assert.deepEqual(proposeAlternatives(terrain({'3,1':{geofence:true},'3,3':{obstacle:true}}),input,context,id),[]);
  input.permitted_substitutions=[];
  assert.deepEqual(proposeAlternatives(terrain(),input,{...context,budget:new LineageBudget(input,0,50000).snapshot(1)},id),[]);
});
