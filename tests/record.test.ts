import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, hash, type ObjectValue, type RecordEvent } from '@open-prospector/contracts';
import { identifier } from '@open-prospector/deterministic';
import { RecordWriter, verifyFile, verifyText } from '@open-prospector/record';
import { defaultInputs } from '@open-prospector/mission-control';

test('record validates before append, retains independent event ordinals and detects incomplete prefix', async () => {
  const { manifest, directive } = await defaultInputs();
  const run = String(manifest.run_id);
  const path = join(await mkdtemp(join(tmpdir(), 'op-record-')), 'events.ndjson');
  const writer = new RecordWriter(path, run);
  writer.append({ event_type: 'run-started', payload: manifest, actor_id: 'actor:mission', subject_id: run, occurred_tick: 0 });
  writer.append({ event_type: 'directive-received', event_id: 'endpoint-event:test', payload: directive,
    actor_id: String(directive.asset_id), subject_id: String(directive.directive_id), occurred_tick: 1, received_tick: 2 });
  const local = writer.append({ event_type: 'directive-submitted', payload: directive, actor_id: 'actor:mission', subject_id: run, occurred_tick: 2 });
  assert.equal(local.event_id, identifier(run, 'mission-event', 2, 1));
  const before = await readFile(path, 'utf8');
  assert.throws(() => writer.append({ event_type: 'run-started', payload: manifest, actor_id: 'actor:mission', subject_id: run, occurred_tick: 3 }));
  assert.equal(await readFile(path, 'utf8'), before);
  writer.close();
  assert.equal(verifyFile(path).status, 'incomplete');
  assert.throws(() => verifyText(before.slice(0, -1)), /Truncated/);
  assert.throws(() => verifyText(before.replaceAll('\n', '\r\n')), /Noncanonical/);
});

test('record rejects altered, reordered, deleted, duplicated and rehashed mismatched records', async () => {
  const { manifest, directive } = await defaultInputs();
  const path = join(await mkdtemp(join(tmpdir(), 'op-mutate-')), 'events.ndjson');
  const writer = new RecordWriter(path, String(manifest.run_id));
  writer.append({ event_type: 'run-started', payload: manifest, actor_id: 'actor:mission', subject_id: String(manifest.run_id), occurred_tick: 0 });
  writer.append({ event_type: 'directive-submitted', payload: directive, actor_id: 'actor:mission', subject_id: String(directive.directive_id), occurred_tick: 0 });
  writer.append({ event_type: 'run-failed', payload: { code: 'test:failure', detail: 'Expected test failure.', safe_state: 'not-applicable' }, actor_id: 'actor:mission', subject_id: String(manifest.run_id), occurred_tick: 1 });
  writer.close();
  const text = await readFile(path, 'utf8');
  assert.equal(verifyText(text).status, 'failed');
  const lines = text.trimEnd().split('\n');
  assert.throws(() => verifyText([lines[0], lines[2], lines[1]].join('\n') + '\n'));
  assert.throws(() => verifyText([lines[0], lines[2]].join('\n') + '\n'));
  assert.throws(() => verifyText([lines[0], lines[1], lines[1]].join('\n') + '\n'));
  for (const patch of [{ payload_kind: 'fault' }, { run_id: 'run:wrong' }, { sequence: 9 }, { payload_hash: 'sha256:' + '0'.repeat(64) }]) {
    const event = { ...JSON.parse(lines[1]!), ...patch } as RecordEvent;
    const { event_hash: _, ...body } = event; event.event_hash = hash(body);
    assert.throws(() => verifyText(lines[0] + '\n' + canonical(event) + '\n'));
  }
  const mutated = JSON.parse(lines[1]!) as ObjectValue;
  (mutated.payload as ObjectValue).author_id = 'actor:changed';
  assert.throws(() => verifyText(lines[0] + '\n' + canonical(mutated) + '\n'));
});
