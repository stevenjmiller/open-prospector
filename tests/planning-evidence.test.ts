import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
test('component trajectory repeats byte-for-byte and ignores unsensed truth and scenario mutations', () => {
  const root=mkdtempSync(join(tmpdir(),'prospector-planning-'));
  const files=['first','second','mutated'].map(name=>join(root,name+'.json'));
  for(let i=0;i<files.length;i++) execFileSync(process.execPath,['scripts/planning-evidence.mjs',files[i]!,...(i===2?['--mutate-unsensed']:[])],{stdio:'pipe'});
  assert.deepEqual(readFileSync(files[0]!),readFileSync(files[1]!));
  assert.deepEqual(readFileSync(files[0]!),readFileSync(files[2]!));
});
