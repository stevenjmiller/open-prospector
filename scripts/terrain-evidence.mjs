import { writeFile } from 'node:fs/promises';
import { verifyCandor } from './verify-candor.mjs';
import { canonical } from '../packages/contracts/dist/index.js';
const output=process.argv[2];if(!output)throw new Error('Provide a new report path');
await writeFile(output,canonical(await verifyCandor('fixtures/candor-sw-v0'))+'\n',{flag:'wx'});
console.log('Candor fixture and observer evidence verified: '+output);
