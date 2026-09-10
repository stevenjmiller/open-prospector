import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { canonical, hash } from '../packages/contracts/dist/index.js';
if (process.versions.node !== '24.12.0') throw new Error('Use pinned Node 24.12.0');
const sources = {};
async function walk(path) {
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : 1)) {
    if (['dist', 'node_modules', 'schemas'].includes(entry.name)) continue;
    const name = path + '/' + entry.name;
    if (entry.isDirectory()) await walk(name);
    else if (/\.(ts|json|mjs)$/.test(name) && !name.endsWith('.tsbuildinfo')) sources[name] = (await readFile(name, 'utf8')).replace(/\r\n/g, '\n');
  }
}
for (const path of ['packages', 'apps', 'scripts', 'fixtures/spine-v0', 'fixtures/controller-v0', 'design/contracts/v0']) await walk(path);
for (const path of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.base.json', 'design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json', 'design/fixtures/vertical-slice/synthetic-v0.scenario.json', 'design/fixtures/vertical-slice/directive-v0.json']) sources[path] = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/build-identity.json', canonical({ source_hash: hash(sources), sources }) + '\n');
