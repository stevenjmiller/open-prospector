import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hash, type ObjectValue } from '@open-prospector/contracts';
import { defaultInputs, type Inputs } from './index.js';
export async function defaultCampaignInputs():Promise<Inputs> {
  const read=async(path:string)=>JSON.parse(await readFile(fileURLToPath(new URL('../../../'+path,import.meta.url)),'utf8')) as ObjectValue;
  const fixture=await read('design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json');
  const scenario=await read('design/fixtures/vertical-slice/synthetic-v0.scenario.json');
  const directive=await read('design/fixtures/vertical-slice/directive-v0.json');
  const {manifest}=await defaultInputs();
  Object.assign(manifest,{run_id:'run:controller-test',fixture_id:fixture.fixture_id,fixture_hash:hash(fixture),scenario_id:scenario.scenario_id,scenario_hash:hash(scenario),directive_id:directive.directive_id,directive_hash:hash(directive),versions:{autonomy:'autonomy.slice-v0',terrain_policy:'terrain.slice-v0',gatekeeper:'pp.no-go.slice-v0',sensor:'synthetic-sensors-v0',body:'grid-rover-v0'},recorded_model_results:await read('fixtures/controller-v0/model-results.json')});
  return {manifest,directive,scenario,fixture};
}
