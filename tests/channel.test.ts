import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Channel } from '@open-prospector/channel';
import { type Intent, type Message, type ObjectValue } from '@open-prospector/contracts';

function status(tick = 0, reason = 'ok'): Intent {
  return { direction: 'asset-to-mission', tier: 'tier-1', priority: 230, sent_tick: tick, payload_kind: 'status',
    payload: { asset_id: 'asset:test', from: 'idle', occurred_tick: tick, reason_code: reason, to: 'planning' } };
}
function artifact(tick = 0): Intent {
  return { direction: 'asset-to-mission', tier: 'tier-2', priority: 100, sent_tick: tick, payload_kind: 'science-artifact',
    payload: { reference: { artifact_id: 'artifact:test', artifact_hash: 'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', byte_length: 2, media_type: 'application/json' }, content_base64: 'W10=' } };
}
const normal = { one_way_latency_ticks: 3000, tier1_bytes_per_tick: 4096, tier2_bytes_per_tick: 1024 };

test('channel reproduces committed negotiated exchange, message IDs and delivery ticks', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../design/contracts/v0/examples/negotiation.json', import.meta.url), 'utf8')) as { scheduled_messages: Message[] };
  const channel = new Channel('run:contract-example-v0', normal, 0);
  for (const expected of fixture.scheduled_messages) {
    const { direction, tier, priority, sent_tick, payload_kind, payload } = expected;
    const actual = channel.enqueue({ direction, tier, priority, sent_tick, payload_kind, payload });
    assert.deepEqual(actual, expected);
    assert.deepEqual(channel.deliver(expected.deliver_at_tick - 1), []);
    assert.deepEqual(channel.deliver(expected.deliver_at_tick), [expected]);
  }
  assert.equal(channel.empty, true);
});

test('transmission counts UTF-8 payload bytes and rounds up at capacity boundaries', () => {
  // The fixed status payload is 92 ASCII bytes. Changing ok to ék adds one UTF-8 byte.
  const profile = { one_way_latency_ticks: 0, tier1_bytes_per_tick: 92, tier2_bytes_per_tick: 1024 };
  const exact = new Channel('run:test', profile, 0).enqueue(status());
  assert.equal(exact.payload_bytes, 92);
  assert.equal(exact.deliver_at_tick, 1);
  const over = new Channel('run:test', profile, 0).enqueue(status(0, 'ék'));
  assert.equal(over.payload_bytes, 93);
  assert.equal(over.deliver_at_tick, 2);
  const delayed = new Channel('run:test', { ...profile, one_way_latency_ticks: 3000 }, 0).enqueue(status(0, 'ék'));
  assert.equal(delayed.deliver_at_tick, 3002);
});

test('FIFO is shared across directions; tier priority never overtakes queued work', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../design/contracts/v0/examples/negotiation.json', import.meta.url), 'utf8')) as { original: ObjectValue; contestation: ObjectValue };
  const channel = new Channel('run:test', normal, 0);
  const first = channel.enqueue(status());
  const second = channel.enqueue({ direction: 'mission-to-asset', tier: 'tier-1', priority: 220, sent_tick: 0, payload_kind: 'cleared-directive', payload: fixture.original });
  const third = channel.enqueue({ direction: 'asset-to-mission', tier: 'tier-1', priority: 240, sent_tick: 0, payload_kind: 'contestation', payload: fixture.contestation });
  assert.deepEqual([first.creation_ordinal, second.creation_ordinal, third.creation_ordinal], [0, 1, 2]);
  assert.deepEqual([first.deliver_at_tick, second.deliver_at_tick, third.deliver_at_tick], [3001, 3002, 3003]);
  assert.deepEqual(channel.deliver(3001), [first]);
  assert.deepEqual(channel.deliver(3002), [second]);
  assert.deepEqual(channel.deliver(3003), [third]);
});

test('tiers have independent links and simultaneous deliveries put Tier 1 first', () => {
  const channel = new Channel('run:test', normal, 0);
  const science = channel.enqueue(artifact());
  const audit = channel.enqueue(status());
  assert.equal(science.creation_ordinal, 0);
  assert.equal(audit.creation_ordinal, 1);
  assert.equal(science.deliver_at_tick, 3001);
  assert.equal(audit.deliver_at_tick, 3001);
  assert.deepEqual(channel.deliver(3001), [audit, science]);
  assert.deepEqual(channel.deliver(3001), []);
  assert.equal(channel.empty, true);
});

test('failed batch consumes neither FIFO time nor message ordinals', () => {
  const channel = new Channel('run:test', normal, 0);
  const invalid = { ...status(), priority: 240 };
  assert.throws(() => channel.enqueueBatch([status(), invalid]));
  assert.equal(channel.empty, true);
  const next = channel.enqueue(status());
  assert.equal(next.creation_ordinal, 0);
  assert.equal(next.deliver_at_tick, 3001);
});

test('enqueue snapshots both payload and caller-owned profile', () => {
  const profile = { ...normal };
  const channel = new Channel('run:test', profile, 0);
  profile.one_way_latency_ticks = 0;
  const input = status();
  const message = channel.enqueue(input);
  input.payload.reason_code = 'changed-after-enqueue';
  message.payload.reason_code = 'changed-return-value';
  const delivered = channel.deliver(3001);
  assert.equal(delivered[0]!.payload.reason_code, 'ok');
});

test('skipping due delivery fails without discarding the queued message', () => {
  const channel = new Channel('run:test', normal, 0);
  const message = channel.enqueue(status());
  assert.throws(() => channel.deliver(3002));
  assert.equal(channel.empty, false);
  assert.deepEqual(channel.deliver(3001), [message]);
});

test('nonzero start tick initializes both serial links', () => {
  const channel = new Channel('run:test', { ...normal, one_way_latency_ticks: 0 }, 10);
  assert.equal(channel.enqueue(status(10)).deliver_at_tick, 11);
  assert.equal(channel.enqueue(artifact(10)).deliver_at_tick, 11);
});

test('invalid channel capacity and safe-integer overflow reject atomically', () => {
  assert.throws(() => new Channel('run:test', { ...normal, tier1_bytes_per_tick: 0 }, 0));
  assert.throws(() => new Channel('run:test', { ...normal, tier2_bytes_per_tick: 0 }, 0));
  assert.throws(() => new Channel('run:test', { ...normal, one_way_latency_ticks: -1 }, 0));
  const channel = new Channel('run:test', normal, 0);
  assert.throws(() => channel.enqueue(status(9007199254740991)));
  assert.equal(channel.empty, true);
  assert.equal(channel.enqueue(status()).creation_ordinal, 0);
});

test('artifact reference cannot substitute for verified canonical base64 bytes', () => {
  const channel = new Channel('run:test', normal, 0);
  for (const payload of [
    { ...artifact().payload, content_base64: 'W11=' }, // Same decoded bytes, nonzero padding bits.
    { ...artifact().payload, content_base64: 'e30=' },
    { ...artifact().payload, reference: { ...(artifact().payload.reference as ObjectValue), byte_length: 3 } },
    { reference: artifact().payload.reference! }
  ]) assert.throws(() => channel.enqueue({ ...artifact(), payload }));
  const valid = channel.enqueue(artifact());
  assert.equal(valid.creation_ordinal, 0);
  assert.ok(valid.payload_bytes > 2, 'budget/transmission includes JSON envelope and base64, not only decoded bytes');
});
