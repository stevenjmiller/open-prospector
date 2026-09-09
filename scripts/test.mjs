import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const tests = (await readdir('tests/dist')).filter(n => n.endsWith('.test.js')).sort().map(n => `tests/dist/${n}`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...tests], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
