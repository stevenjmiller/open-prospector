import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonical } from '../packages/contracts/dist/index.js';
import { materializeSynthetic } from '../packages/simulation-world/dist/index.js';
import { archivedInputs } from '../apps/mission-control/dist/index.js';
import { defaultCampaignInputs } from '../apps/mission-control/dist/campaign-inputs.js';
import { runCampaign } from '../apps/mission-control/dist/campaign.js';
import { verifyCampaign, auditCampaign } from '../apps/mission-control/dist/campaign-audit.js';
const [command='run',first='artifacts/campaign-run',second]=process.argv.slice(2);
try {
  if(command==='verify'||command==='audit') {
    const verified=await verifyCampaign(first);
    console.log(JSON.stringify(command==='audit'?await auditCampaign(first):{status:verified.status,head:verified.head,events:verified.events.length},null,2));
    if(verified.status!=='completed')process.exitCode=1;
  } else if(command==='replay') {
    if(!second)throw new Error('Usage: npm run campaign -- replay <bundle> <new-output>');
    const original=await verifyCampaign(first);if(original.status!=='completed')throw new Error('Replay requires a verified complete archive');
    await mkdir(dirname(resolve(second)),{recursive:true});
    const result=await runCampaign({output:second,inputs:await archivedInputs(first),fixtureRoot:join(first,'fixture')});
    if(result.status!=='completed'||result.head!==original.head||await readFile(join(first,'telemetry.ndjson'),'utf8')!==await readFile(join(second,'telemetry.ndjson'),'utf8'))throw new Error('Replay differs');
    console.log(JSON.stringify({...result,replay:'byte-identical'}));
  } else if(command==='run') {
    const inputs=await defaultCampaignInputs();
    const temp=await mkdtemp(join(tmpdir(),'op-campaign-fixture-')),fixtureRoot=join(temp,'fixture');materializeSynthetic(fixtureRoot,inputs.fixture);
    await mkdir(dirname(resolve(first)),{recursive:true});
    const result=await runCampaign({output:first,inputs,fixtureRoot});
    await writeFile(join(first,'audit.json'),canonical(await auditCampaign(first))+'\n');
    console.log(JSON.stringify(result));if(result.status!=='completed')process.exitCode=1;
  } else throw new Error('Commands: run, verify, audit, replay');
} catch(error){console.error(String(error));process.exitCode=1;}
