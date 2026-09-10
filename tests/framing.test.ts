import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameDecoder } from '@open-prospector/contracts';
test('raw decoder handles split UTF-8 and batched frames without normalizing wire bytes', () => {
  const decoder = new FrameDecoder();
  const bytes = Buffer.from('{"name":"é"}\n{}\n');
  const first = bytes.indexOf(0xc3) + 1;
  assert.deepEqual(decoder.push(bytes.subarray(0, first)), []);
  assert.deepEqual(decoder.push(bytes.subarray(first)), [{ name: 'é' }, {}]);
  decoder.end();
});
test('raw decoder rejects CRLF, BOM, malformed UTF-8, oversized and truncated frames', () => {
  for (const bytes of [Buffer.from('{}\r\n'), Buffer.from('\ufeff{}\n'), Buffer.from([0x22, 0xff, 0x22, 10])]) {
    assert.throws(() => new FrameDecoder().push(bytes));
  }
  assert.throws(() => new FrameDecoder(2).push(Buffer.from('{"a":1}\n')));
  const decoder = new FrameDecoder(); decoder.push(Buffer.from('{}'));
  assert.throws(() => decoder.end(), /Truncated/);
});
