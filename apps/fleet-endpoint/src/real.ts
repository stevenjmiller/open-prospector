import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hash, parseCanonical, validate, validateFixture, type ObjectValue } from '@open-prospector/contracts';
import { loadAssetFixture, projectScenario } from '@open-prospector/belief';
import { createSensorAdapter, loadWorld } from '@open-prospector/simulation-world';
import { EndpointController, RecordedClassifier, type ControllerConfig, type KnownTarget, type HazardView } from '@open-prospector/autonomy';

/** Privileged executable shell. The controller gets neither manifest nor scenario. */
export function createRuntime(frame:ObjectValue):EndpointController {
  validate('ipc-frame',frame);
  if(frame.frame!=='init') throw new Error('Expected init');
  const manifest=frame.run_manifest as ObjectValue, scenario=frame.scenario as ObjectValue;
  validate('run-manifest',manifest); validate('scenario',scenario);
  const root=String(frame.fixture_root);
  const source=readFileSync(join(root,'fixture-manifest.json'),'utf8');
  const fixture=validateFixture(parseCanonical(source.endsWith('\n')?source.slice(0,-1):source));
  if(hash(fixture)!==manifest.fixture_hash||hash(scenario)!==manifest.scenario_hash||fixture.fixture_id!==manifest.fixture_id||scenario.fixture_id!==manifest.fixture_id||scenario.scenario_id!==manifest.scenario_id) throw new Error('Endpoint initialization identity mismatch');
  const versions=manifest.versions as ObjectValue;
  if(versions.autonomy!=='autonomy.slice-v0'||versions.sensor!=='synthetic-sensors-v0'||versions.body!=='grid-rover-v0') throw new Error('Unsupported controller profile');
  const projection=projectScenario(scenario,'asset');
  const asset=projection.asset as unknown as ControllerConfig['asset'];
  const config:ControllerConfig={run_id:String(manifest.run_id),start_tick:Number((manifest.clock as ObjectValue).start_tick),round_trip_ticks:Number((manifest.channel as ObjectValue).one_way_latency_ticks)*2,
    original_directive_id:String(manifest.directive_id),original_directive_hash:String(manifest.directive_hash),asset,targets:projection.target_entities as unknown as KnownTarget[],hazards:projection.hazards as unknown as HazardView[],prng_seed_words:(manifest.prng as ObjectValue).seed_words as number[]};
  const belief=loadAssetFixture(root,fixture,config.run_id,asset.asset_id);
  const sensors=createSensorAdapter(loadWorld(root,fixture),scenario);
  return new EndpointController(config,belief,sensors,new RecordedClassifier(manifest.recorded_model_results as ObjectValue[]));
}
