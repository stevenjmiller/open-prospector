import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, hash, type ObjectValue } from '@open-prospector/contracts';
import { runSpine, defaultInputs, verifyBundle, archivedInputs } from '@open-prospector/mission-control';
import { verifyFile } from '@open-prospector/record';
async function fastInputs() {
  const inputs = await defaultInputs();
  inputs.manifest.channel = { one_way_latency_ticks: 2, tier1_bytes_per_tick: 4096, tier2_bytes_per_tick: 32 };
  return inputs;
}
test('two real child processes reproduce chain/checkpoint and drain delayed Tier-2 evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'op-spine-'));
  const inputs = await fastInputs();
  const first = await runSpine({ output: join(root, 'first'), inputs });
  const second = await runSpine({ output: join(root, 'second'), inputs: await archivedInputs(first.output) });
  assert.equal(first.status, 'completed'); assert.equal(first.head, second.head); assert.equal(first.finalStateHash, second.finalStateHash);
  assert.equal(await readFile(join(first.output, 'events.ndjson'), 'utf8'), await readFile(join(second.output, 'events.ndjson'), 'utf8'));
  const events = (await verifyBundle(first.output)).events;
  const ack = events.find(e => e.event_type === 'directive-received')!;
  assert.ok(ack.received_tick! > ack.occurred_tick);
  assert.equal(ack.recorded_tick, ack.received_tick);
  const terminal = events.find(e => e.event_type === 'endpoint-state-changed' && e.payload.to === 'completed')!;
  const update = events.find(e => e.event_type === 'received-belief-updated')!;
  assert.ok(update.recorded_tick > terminal.recorded_tick, 'Tier-2 evidence must arrive after terminal state in this profile');
  assert.ok(events.at(-1)!.recorded_tick >= update.recorded_tick);
  assert.equal(events.at(-1)!.payload.event_chain_head, events.at(-2)!.event_hash);
  assert.equal(events.filter(e => e.event_type === 'run-completed').length, 1);
  const incomplete = join(root, 'incomplete'); await cp(first.output, incomplete, { recursive: true });
  const text = await readFile(join(incomplete, 'events.ndjson'), 'utf8');
  await writeFile(join(incomplete, 'events.ndjson'), text.trimEnd().split('\n').slice(0, -1).join('\n') + '\n');
  assert.equal((await verifyBundle(incomplete)).status, 'incomplete');
  for (const mutation of ['observation','build','schema','lock','artifact']) {
    const output = join(root, mutation); await cp(first.output, output, { recursive: true });
    if (mutation === 'observation') {
      const value = JSON.parse(await readFile(join(output, 'observation.json'), 'utf8')) as ObjectValue;
      value.footprint_cells = [{ row: 1, column: 1 }];
      await writeFile(join(output, 'observation.json'), canonical(value) + '\n');
    } else if (mutation === 'build') await writeFile(join(output, 'build-identity.json'), canonical({ source_hash: 'sha256:' + '0'.repeat(64), sources: {} }) + '\n');
    else if (mutation === 'schema') await writeFile(join(output, 'schemas/directive.schema.json'), '{}\n');
    else if (mutation === 'lock') await writeFile(join(output, 'package-lock.json'), '{}\n');
    else {
      const obs = JSON.parse(await readFile(join(output, 'observation.json'), 'utf8')) as ObjectValue;
      const refs = obs.artifact_refs as ObjectValue[];
      await writeFile(join(output, 'science', String(refs[0]!.artifact_hash).slice(7)), '[]');
    }
    await assert.rejects(verifyBundle(output), { name: 'Error' }, mutation);
  }
});

for (const fault of ['crash-after-emit','malformed-after-emit','wrong-ready','wrong-done','duplicate-done','wrong-stopped','missing-artifact','missing-reference','terminal-failed','hang-init']) {
  test(`fault ${fault} cannot produce a successful archive`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'op-fault-'));
    const result = await runSpine({ output: join(root, 'run'), inputs: await fastInputs(), fault, watchdogMs: fault === 'hang-init' ? 500 : 10_000 });
    assert.equal(result.status, 'failed'); assert.equal(result.finalStateHash, undefined);
    const events = verifyFile(join(result.output, 'events.ndjson')).events;
    assert.equal(events.at(-1)!.event_type, 'run-failed');
    assert.equal(events.some(e => e.event_type === 'run-completed'), false);
    if (['crash-after-emit','malformed-after-emit'].includes(fault)) {
      assert.equal(events.some(e => e.event_type === 'directive-received'), false, 'Uncommitted intents must not reach the record');
    }
    if (fault === 'terminal-failed') assert.match(String(events.at(-1)!.payload.code), /^endpoint:failed:/);
    else assert.equal(events.at(-1)!.payload.safe_state, 'not-applicable');
  });
}
test('inputs and archived build must match before starting a run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'op-input-'));
  const inputs = await fastInputs(); inputs.directive.author_id = 'actor:tampered';
  await assert.rejects(runSpine({ output: join(root,'tampered'), inputs }), /identity mismatch/);
  inputs.manifest.directive_hash = hash(inputs.directive);
  (inputs.manifest.build as ObjectValue).source_revision = 'sha256:' + '0'.repeat(64);
  await assert.rejects(runSpine({ output: join(root,'different-build'), inputs }), /archived build/);
});
