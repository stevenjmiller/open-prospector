import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const [left,right] = process.argv.slice(2);
if (!left || !right) throw new Error('Provide two completed run directories');
for (const name of ['events.ndjson','inputs/manifest.json','observation.json', ...(process.argv.includes('--planning') ? ['component-planning.json'] : []), ...(process.argv.includes('--controller') ? ['controller/manifest.json','controller/endpoint-intents.ndjson','controller/report.json'] : [])]) {
  assert.deepEqual(await readFile(join(left,name)),await readFile(join(right,name)),name + ' differs across platforms');
}
console.log('Windows and Linux authoritative bytes match exactly.');
