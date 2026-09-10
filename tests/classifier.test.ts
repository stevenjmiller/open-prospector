import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordedClassifier, type ClassifierInput, type State } from '@open-prospector/autonomy';
import { clone, hash } from '@open-prospector/contracts';

const input = { observation_id: 'observation:rock', sensor_id: 'sensor:obstacle', artifact_hash: `sha256:${'a'.repeat(64)}` };
const output = { model_id: 'model:stub-rock-v0', label: 'rock', confidence_ppm: 900000 };
function record() {
  return { seam_id: 'seam:rock-classifier-v0', input_hash: hash(input), output_hash: hash(output), output: clone(output) };
}

test('recorded seam consumes exact canonical input once, only after safe hold, and copies all outputs', () => {
  const source = record();
  const seam = createRecordedClassifier([source]);
  source.output.label = 'not-rock';
  assert.deepEqual(seam.snapshot(), { consumed: false, record_hash: hash(record()), result: null });
  for (const state of ['idle', 'planning', 'scheduled', 'holding', 'executing', 'locked', 'completed', 'failed', 'faulted']) {
    assert.throws(() => seam.consume(state as State, input), /safely stopped/);
    assert.equal(seam.snapshot().consumed, false);
  }
  const consumed = seam.consume('safe-hold', { artifact_hash: input.artifact_hash, sensor_id: input.sensor_id, observation_id: input.observation_id });
  assert.deepEqual(consumed, record());
  consumed.output.label = 'indeterminate';
  const snapshot = seam.snapshot();
  assert.deepEqual(snapshot.result, record());
  snapshot.result!.output.label = 'not-rock';
  assert.deepEqual(seam.snapshot().result, record());
  assert.throws(() => seam.consume('safe-hold', input), /already consumed/);
});

test('missing, wrong-seam, duplicate, malformed and hash-tampered records fail without a fallback', () => {
  assert.throws(() => createRecordedClassifier([]), /Exactly one/);
  assert.throws(() => createRecordedClassifier([{ ...record(), seam_id: 'seam:other' }]), /Exactly one/);
  assert.throws(() => createRecordedClassifier([record(), record()]), /Exactly one/);
  assert.throws(() => createRecordedClassifier([{ ...record(), output_hash: input.artifact_hash }]), /output hash/);
  for (const invalid of [{ ...output, label: 'boulder' }, { ...output, confidence_ppm: 1000001 }, { ...output, extra: true }]) {
    assert.throws(() => createRecordedClassifier([{ ...record(), output: invalid, output_hash: hash(invalid) }]));
  }
});

test('all three exact input fields are bound and failed consumption leaves the seam available', () => {
  const seam = createRecordedClassifier([record()]);
  for (const bad of [
    { ...input, observation_id: 'observation:another' },
    { ...input, sensor_id: 'sensor:another' },
    { ...input, artifact_hash: `sha256:${'b'.repeat(64)}` },
  ]) assert.throws(() => seam.consume('safe-hold', bad), /input hash/);
  for (const bad of [{ ...input, extra: true }, { observation_id: input.observation_id, sensor_id: input.sensor_id }, { ...input, artifact_hash: 'bad' }]) {
    assert.throws(() => seam.consume('safe-hold', bad as ClassifierInput));
  }
  assert.equal(seam.snapshot().consumed, false);
  assert.deepEqual(seam.consume('safe-hold', input), record());
});
