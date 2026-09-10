import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { canonical, clone, hash, hashBytes, parseCanonical, validate, type ObjectValue, type RecordEvent } from '@open-prospector/contracts';
import { add, ceilDivide, Clock, identifier, unsigned } from '@open-prospector/deterministic';

const root = new URL('../../', import.meta.url);
function read(path: string): ObjectValue {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8')) as ObjectValue;
}
const exchange = read('design/contracts/v0/examples/negotiation.json');

test('canonical JSON sorts numeric-looking and UTF-16 keys without changing arrays', () => {
  assert.equal(canonical({ '2': 2, '10': 10, b: [3, 1], a: null }), '{"10":10,"2":2,"a":null,"b":[3,1]}');
  assert.equal(canonical({ '\uE000': 1, '\u{10000}': 2, '\r': 3 }), '{"\\r":3,"\u{10000}":2,"\uE000":1}');
  assert.equal(canonical({ text: 'é\n\t"\\', flag: true }), '{"flag":true,"text":"é\\n\\t\\"\\\\"}');
  assert.equal(canonical([-9007199254740991, 0, 9007199254740991]), '[-9007199254740991,0,9007199254740991]');
  assert.notEqual(canonical('é'), canonical('e\u0301'), 'Unicode normalization must not alter source strings');
});

test('canonical parser rejects ambiguous, lossy, or noncanonical source bytes', () => {
  const invalid = [
    '{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"x":{"a":1,"a":1}}',
    '1.0', '1e0', '-0', '9007199254740992', '0.5',
    '{"b":2,"a":1}', ' {"a":1}', '{"a":1}\n', '{"a":1}\r\n', '\uFEFF{}',
    '{"a": 1}', '"\\u0061"', '"\\/"', '"\\ud800"', '"\\udc00"', '{"a":'
  ];
  for (const input of invalid) assert.throws(() => parseCanonical(input), JSON.stringify(input));
  assert.deepEqual(parseCanonical('{"a":[1,true,null,"é"]}'), { a: [1, true, null, 'é'] });
});

test('canonical serialization rejects non-JSON memory values and cycles', () => {
  const cycle: unknown[] = []; cycle.push(cycle);
  for (const value of [NaN, Infinity, -Infinity, -0, undefined, 1n, new Date(), new Map(), [, 1], cycle,
    { x: undefined }, { [Symbol('hidden')]: 1 }, '\ud800', '\udc00']) {
    assert.throws(() => canonical(value));
  }
  const shared = { a: 1 };
  assert.equal(canonical([shared, shared]), '[{"a":1},{"a":1}]', 'shared references are not cycles');
});

test('hashes and identifiers match independently frozen answers', () => {
  assert.equal(hashBytes(Buffer.from('abc')), 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hash([]), 'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945');
  assert.equal(identifier('run:contract-example-v0', 'message', 0, 0), 'message:b88e7caf2fd8a842dd1b2c66');
  assert.equal(identifier('run:contract-example-v0', 'message', 3001, 1), 'message:291dc77172efebb17fabe669');
  assert.equal(identifier('run:contract-example-v0', 'message', 6012, 2), 'message:1084b496d24d54a34c6cec22');
  assert.notEqual(identifier('run:test', 'mission-event', 1, 0), identifier('run:test', 'endpoint-event', 1, 0));
});

test('integer helpers preserve safe-range arithmetic and reject overflow', () => {
  assert.equal(ceilDivide(9007199254740991, 2), 4503599627370496);
  assert.equal(ceilDivide(0, 4), 0);
  assert.equal(add(9007199254740990, 1), 9007199254740991);
  for (const value of [-1, -0, 0.1, NaN, Infinity, 9007199254740992]) assert.throws(() => unsigned(value));
  assert.throws(() => add(9007199254740991, 1));
  assert.throws(() => ceilDivide(1, 0));
  assert.throws(() => identifier('run:test', 'message', -1, 0));
  assert.throws(() => identifier('run:test', 'message', 0, 0.5));
  const clock = new Clock(9007199254740990);
  assert.equal(clock.advance(), 9007199254740991);
  assert.throws(() => clock.advance());
  assert.equal(clock.tick, 9007199254740991);
});

test('all committed negotiation and failure examples validate', () => {
  for (const [key, schema] of [
    ['original', 'directive'], ['revision', 'directive'], ['contestation', 'contestation'],
    ['emit_frame', 'ipc-frame'], ['acceptance', 'protocol-payload#/$defs/AlternativeAcceptance']
  ]) validate(schema!, exchange[key!]);
  for (const message of exchange.scheduled_messages as ObjectValue[]) validate('channel-message', message);
  validate('ipc-frame', read('design/contracts/v0/examples/budget-exhaustion.json'));
  validate('contestation', read('design/contracts/v0/examples/no-alternative.json'));
  validate('endpoint-event', read('design/contracts/v0/examples/no-alternative-transition.json'));
  for (const name of readdirSync(new URL('design/fixtures/vertical-slice/', root)).filter(n => n.endsWith('.json'))) {
    const fixture = read('design/fixtures/vertical-slice/' + name);
    validate(String(fixture.schema_version).replace(/-v0$/, ''), fixture);
  }
});

test('directive validation rejects structural and temporal contract violations', () => {
  const original = exchange.original as ObjectValue;
  for (const patch of [{ extra: true }, { revision: 0.5 }, { deadline_tick: 9007199254740992 },
    { safe_idle: 'return-to-start' }, { deadline_tick: original.earliest_start_tick }]) {
    assert.throws(() => validate('directive', { ...original, ...patch }));
  }
  const reversed = clone(original);
  (reversed.operating_envelope as ObjectValue).min_row = 255;
  assert.throws(() => validate('directive', reversed));
});

test('channel message integrity rejects altered byte counts, hashes, and payload bindings', () => {
  const message = (exchange.scheduled_messages as ObjectValue[])[0]!;
  assert.throws(() => validate('channel-message', { ...message, payload_bytes: Number(message.payload_bytes) + 1 }));
  assert.throws(() => validate('channel-message', { ...message, payload_hash: hash(null) }));
  assert.throws(() => validate('channel-message', { ...message, payload_hash: 'sha256:' + 'A'.repeat(64) }));
  assert.throws(() => validate('channel-message', { ...message, payload_kind: 'status' }));
  assert.throws(() => validate('channel-message', { ...message, direction: 'asset-to-mission' }));
  assert.throws(() => validate('channel-message', { ...message, tier: 'tier-2' }));
});

test('contestation links and computed windows are checked beyond schemas', () => {
  const bad = clone(exchange.contestation as ObjectValue);
  (bad.alternative_ids as string[]).reverse();
  assert.throws(() => validate('contestation', bad));
  const wrongLink = clone(exchange.contestation as ObjectValue);
  (wrongLink.alternatives as ObjectValue[])[0]!.hazard_id = 'hazard:unrelated';
  assert.throws(() => validate('contestation', wrongLink));
  assert.throws(() => validate('contestation', { ...(exchange.contestation as ObjectValue), window_open: false }));
});

test('endpoint envelopes enforce event binding and source tick', () => {
  const event = read('design/contracts/v0/examples/no-alternative-transition.json');
  assert.throws(() => validate('endpoint-event', { ...event, event_type: 'directive-received' }));
  const frame = clone(read('design/contracts/v0/examples/budget-exhaustion.json'));
  const intent = frame.intent as ObjectValue;
  intent.sent_tick = Number(intent.sent_tick) + 1;
  assert.throws(() => validate('outbound-intent', intent));
  intent.deliver_at_tick = 10;
  assert.throws(() => validate('ipc-frame', frame));
});

test('record event binding and timestamp relationships cannot be bypassed with valid hashes', () => {
  const payload = { at_tick: 4, state_hash: hash([]) };
  const event: RecordEvent = {
    schema_version: 'record-event-v0', event_id: 'mission-event:test', run_id: 'run:test', sequence: 0,
    occurred_tick: 4, received_tick: null, recorded_tick: 4, event_type: 'checkpoint-created',
    actor_id: 'actor:test', subject_id: 'run:test', payload_kind: 'checkpoint', payload,
    payload_hash: hash(payload), prev_event_hash: null, event_hash: hash([])
  };
  validate('record-event', event);
  assert.throws(() => validate('record-event', { ...event, event_type: 'run-failed' }));
  assert.throws(() => validate('record-event', { ...event, payload_kind: 'fault' }));
  assert.throws(() => validate('record-event', { ...event, payload_hash: hash(null) }));
  assert.throws(() => validate('record-event', { ...event, recorded_tick: 5 }));
  assert.throws(() => validate('record-event', { ...event, received_tick: 3, recorded_tick: 3 }));
  assert.throws(() => validate('record-event', { ...event, received_tick: 5, recorded_tick: 6 }));
  validate('record-event', { ...event, received_tick: 5, recorded_tick: 5 });
});
