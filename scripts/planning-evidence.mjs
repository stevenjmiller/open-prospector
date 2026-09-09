import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { canonical, clone, hash } from '../packages/contracts/dist/index.js';
import { loadAssetFixture, projectScenario } from '../packages/belief/dist/index.js';
import { createSensorAdapter, generateSynthetic, reflexWindow } from '../packages/simulation-world/dist/index.js';
import { EdgeMotion, LineageBudget, edgeEstimate, planDirective, proposeAlternatives, standoffEligible } from '../packages/autonomy/dist/index.js';

// Privileged component harness. This is not a controller, clearance or science run.
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const manifest = read('design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json');
const scenario = read('design/fixtures/vertical-slice/synthetic-v0.scenario.json');
const original = read('design/fixtures/vertical-slice/directive-v0.json');
const layers = generateSynthetic(manifest);
if (process.argv.includes('--mutate-unsensed')) {
  layers.get('truth-elevation').writeInt32LE(123456, (100 * 256 + 200) * 4);
  layers.get('truth-obstacles')[100 * 256 + 200] = 1;
  scenario.hazards.push({ hazard_id: 'hazard:unsensed', kind: 'rock', policy_class: 'reflex-if-closed', cells: [{row:100,column:200}], initially_known_to_asset: false, initially_known_to_mission: false });
}
const world = { cell(row,column) { const i = row * 256 + column; return { elevation_mm: layers.get('truth-elevation').readInt32LE(i * 4), obstacle: layers.get('truth-obstacles')[i] === 1, geofence: layers.get('geofence')[i] === 1 }; } };
const asset = loadAssetFixture('', manifest, 'run:planning-component', scenario.asset.asset_id, (_root,layer) => layers.get(layer.name));
const sensors = createSensorAdapter(world, scenario);
const budget = new LineageBudget(original, 0, scenario.asset.starting_energy_units);
const targets = projectScenario(scenario, 'asset').target_entities;
let ordinal = 0;
const metadata = tick => ({ run_id:'run:planning-component', asset_id:scenario.asset.asset_id, observation_id:`observation:component-${ordinal++}`, observed_tick:tick });
const observations = [];
const apply = (sample,tick) => {
  budget.reserveTier2(tick,'observation',sample.observation);
  asset.observe(sample.observation,tick);
  observations.push({ tick, observation_hash:hash(sample.observation), contact:sample.contact });
};
budget.checkTime(10);
apply(sensors.sweep(scenario.asset.start_cell,metadata(10)),10);
const context = (cell,tick) => ({current_cell:cell,current_tick:tick,budget:budget.snapshot(tick),targets});
const alternatives = proposeAlternatives(asset,original,context(scenario.asset.start_cell,10),{run_id:'run:planning-component',contestation_id:'contestation:component',hazard_id:'hazard:slump-v0',first_ordinal:0});
assert.equal(alternatives.length,2);
assert.deepEqual(alternatives[0].proposed_cell,{row:180,column:70});
assert.deepEqual(alternatives[1].proposed_cell,{row:185,column:95});
assert.ok(alternatives[0].proposed_route.some(cell=>cell.row===205&&cell.column===45));
const revision = { ...clone(original), directive_id:'directive:component-r1', revision:1, supersedes_directive_id:original.directive_id, observation_cell:alternatives[0].proposed_cell, advisory_route:alternatives[0].proposed_route };
const beforeRevision = budget.snapshot(10).usage;
budget.revise(revision,10);
assert.deepEqual(budget.snapshot(10).usage,beforeRevision);
const planned = planDirective(asset,revision,context(scenario.asset.start_cell,10));
assert.ok(planned);
const route = planned.route.cells;
const motion = new EdgeMotion(route[0]);
let next = 1, stopped;
for (let tick = planned.planned_start_tick; tick < 2000; tick++) {
  budget.checkTime(tick);
  if (motion.pose().from_cell.row === motion.pose().to_cell.row && motion.pose().from_cell.column === motion.pose().to_cell.column) motion.start(route[next],edgeEstimate(asset,motion.occupancy(),route[next]));
  const pose = motion.pose(), sample = sensors.obstacleRange(pose,route.slice(next-1),metadata(tick));
  if (sample) {
    apply(sample,tick);
    if (sample.contact) {
      const usage = budget.snapshot(tick).usage;
      const window = reflexWindow(sample.contact.distance_mm,100,6000);
      assert.equal(window.window_open,false);
      assert.ok(sample.contact.distance_mm>window.stopping_distance_mm);
      assert.deepEqual(motion.pose(),pose); // detection suppresses this tick's movement
      motion.abandon();
      assert.deepEqual(budget.snapshot(tick).usage,usage);
      budget.checkTime(tick);
      apply(sensors.sweep(motion.occupancy(),metadata(tick)),tick);
      const beforeReplan = budget.snapshot(tick).usage;
      const recovery = planDirective(asset,revision,context(motion.occupancy(),tick));
      assert.ok(recovery);
      assert.ok(!recovery.route.cells.some(cell=>cell.row===205&&cell.column===45));
      assert.deepEqual(budget.snapshot(tick).usage,beforeReplan);
      assert.equal(standoffEligible(asset,recovery.route.cells.at(-1),targets[0].cell),true);
      stopped = {tick,pose,occupancy:motion.occupancy(),window,before_replan:beforeReplan,recovery};
      break;
    }
  }
  motion.step(tick,budget);
  const occupied = motion.occupancy();
  if (occupied.row===route[next].row&&occupied.column===route[next].column) next++;
  assert.ok(next<route.length,'Expected rock detection before reaching vantage');
}
assert.ok(stopped,'Expected precontact reflex');
const report = {profile:'planning-components-v0',alternatives,planned,observations,stopped,belief_hash:asset.stateHash(),budget:budget.snapshot(stopped.tick)};
const output = process.argv[2] ?? 'artifacts/planning-evidence.json';
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,canonical(report)+'\n',{flag:'wx'});
console.log(`Verified frozen alternatives, precontact reflex at tick ${stopped.tick}, and affordable recovery: ${output}`);
