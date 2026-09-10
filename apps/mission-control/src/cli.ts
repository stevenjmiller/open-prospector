import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runSpine, verifyBundle, archivedInputs } from './index.js';
const [command, first, second] = process.argv.slice(2);
try {
  if (command === 'verify') {
    if (!first) throw new Error('Usage: npm run verify -- <bundle>');
    const result = await verifyBundle(resolve(first));
    console.log(JSON.stringify({ status: result.status, head: result.head, events: result.events.length }));
    if (result.status !== 'completed') process.exitCode = 1;
  } else if (command === 'replay') {
    if (!first || !second) throw new Error('Usage: npm run replay -- <bundle> <new-output>');
    const result = await runSpine({ output: second, inputs: await archivedInputs(first) });
    const original = await verifyBundle(first);
    if (result.head !== original.head) throw new Error('Replay chain differs');
    console.log(JSON.stringify(result));
  } else {
    const output = resolve(command ?? 'artifacts/spine-run');
    await mkdir(dirname(output), { recursive: true });
    const result = await runSpine({ output });
    console.log(JSON.stringify(result));
    if (result.status !== 'completed') process.exitCode = 1;
  }
} catch (error) { console.error(String(error)); process.exitCode = 1; }
