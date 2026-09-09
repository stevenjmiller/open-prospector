import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
export { FrameDecoder } from './framing.js';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ObjectValue = { [key: string]: Json };
export type Direction = 'mission-to-asset' | 'asset-to-mission';
export type Tier = 'tier-1' | 'tier-2';
export interface Intent {
  direction: Direction; tier: Tier; priority: number; sent_tick: number;
  payload_kind: string; payload: ObjectValue;
}
export interface Message extends Intent {
  schema_version: 'channel-message-v0'; message_id: string; run_id: string;
  creation_ordinal: number; deliver_at_tick: number; payload_hash: string; payload_bytes: number;
}
export interface EndpointEvent {
  event_id: string; occurred_tick: number; actor_id: string; subject_id: string;
  event_type: string; payload: ObjectValue;
}
export interface RecordEvent extends EndpointEvent {
  schema_version: 'record-event-v0'; run_id: string; sequence: number;
  received_tick: number | null; recorded_tick: number; payload_kind: string;
  payload_hash: string; prev_event_hash: string | null; event_hash: string;
}
export interface ChannelProfile {
  one_way_latency_ticks: number; tier1_bytes_per_tick: number; tier2_bytes_per_tick: number;
}

function stringBytes(value: string): string {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error('Lone high surrogate');
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new Error('Lone low surrogate');
  }
  return JSON.stringify(value);
}

/** RFC 8785 restricted to safe integers. Emit sorted members directly: integer keys
 * must not be reordered by JavaScript's object enumeration rules. */
export function canonical(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown): string {
    if (item === null) return 'null';
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'string') return stringBytes(item);
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item) || Object.is(item, -0)) throw new Error('Noncanonical number');
      return String(item);
    }
    if (typeof item !== 'object' || ancestors.has(item)) throw new Error('Non-JSON or cyclic value');
    ancestors.add(item);
    let result: string;
    if (Array.isArray(item)) {
      result = '[' + Array.from({ length: item.length }, (_, i) => encode(item[i])).join(',') + ']';
    } else {
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
        throw new Error('Non-plain JSON object');
      }
      if (Object.getOwnPropertySymbols(item).length) throw new Error('Symbol JSON key');
      result = '{' + Object.keys(item).sort().map(key => stringBytes(key) + ':' + encode((item as ObjectValue)[key])).join(',') + '}';
    }
    ancestors.delete(item);
    return result;
  }
  return encode(value);
}

export function parseCanonical(text: string): Json {
  const value: unknown = JSON.parse(text);
  // This also rejects duplicate keys, escaped equivalent keys, alternate numeric
  // tokens, BOM, CRLF, whitespace and alternate string escapes on the wire.
  if (canonical(value) !== text) throw new Error('Noncanonical JSON input');
  return value as Json;
}
export function hash(value: unknown): string { return hashBytes(Buffer.from(canonical(value), 'utf8')); }
export function hashBytes(bytes: Uint8Array): string { return 'sha256:' + createHash('sha256').update(bytes).digest('hex'); }
export function clone<T>(value: T): T { return parseCanonical(canonical(value)) as T; }

const base = 'https://schemas.openprospector.invalid/v0/';
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
const schemaFolder = new URL('../schemas/', import.meta.url);
for (const name of readdirSync(schemaFolder).filter(n => n.endsWith('.schema.json')).sort()) {
  ajv.addSchema(JSON.parse(readFileSync(new URL(name, schemaFolder), 'utf8')));
}

export const recordPayloads: Readonly<Record<string, string>> = Object.freeze({
  'run-started': 'run-manifest', 'directive-submitted': 'directive', 'directive-received': 'directive',
  'directive-revised': 'directive', 'gatekeeper-evaluated': 'gatekeeper-result',
  'directive-transmitted': 'channel-message', 'plan-proposed': 'plan-summary',
  'contestation-opened': 'contestation', 'alternative-accepted': 'alternative-acceptance',
  'endpoint-state-changed': 'state-transition', 'observation-summarized': 'observation-summary',
  'received-belief-updated': 'belief-update-summary', 'classifier-result-consumed': 'classifier-result',
  'checkpoint-created': 'checkpoint', 'run-completed': 'run-summary', 'run-failed': 'fault', 'endpoint-fault': 'fault'
});
const payloadSchemas: Readonly<Record<string, string>> = {
  'run-manifest': 'run-manifest', directive: 'directive', 'channel-message': 'channel-message', contestation: 'contestation',
  'gatekeeper-result': 'protocol-payload#/$defs/GatekeeperResult', 'plan-summary': 'protocol-payload#/$defs/PlanSummary',
  'alternative-acceptance': 'protocol-payload#/$defs/AlternativeAcceptance', 'state-transition': 'protocol-payload#/$defs/StateTransition',
  'observation-summary': 'protocol-payload#/$defs/ObservationSummary', 'belief-update-summary': 'protocol-payload#/$defs/BeliefUpdateSummary',
  'classifier-result': 'protocol-payload#/$defs/ClassifierResult', checkpoint: 'protocol-payload#/$defs/Checkpoint',
  'run-summary': 'protocol-payload#/$defs/RunSummary', fault: 'protocol-payload#/$defs/Fault'
};

export function validate(kind: string, value: unknown): void {
  canonical(value); // Schema bounds alone do not cover every untyped nested value.
  const [name, fragment] = kind.split('#');
  const id = base + name + '.schema.json' + (fragment === undefined ? '' : '#' + fragment);
  const validator = ajv.getSchema(id);
  if (!validator) throw new Error('Unknown schema: ' + kind);
  if (!validator(value)) throw new Error(kind + ': ' + ajv.errorsText(validator.errors));
  const v = value as ObjectValue;
  if (kind === 'directive') {
    if (Number(v.deadline_tick) <= Number(v.earliest_start_tick)) throw new Error('Invalid directive time range');
    const r = v.operating_envelope as ObjectValue;
    if (Number(r.min_row) > Number(r.max_row) || Number(r.min_column) > Number(r.max_column)) throw new Error('Reversed envelope');
  }
  if (kind === 'run-manifest') {
    if (((v.prng as ObjectValue).seed_words as number[]).every(n => n === 0)) throw new Error('All-zero PRNG seed');
    for (const result of v.recorded_model_results as ObjectValue[]) {
      if (hash(result.output) !== result.output_hash) throw new Error('Model output hash mismatch');
    }
  }
  if (kind === 'contestation') {
    const alternatives = v.alternatives as ObjectValue[];
    if (canonical(alternatives.map(a => a.alternative_id)) !== canonical(v.alternative_ids)) throw new Error('Alternative ids mismatch');
    for (const a of alternatives) {
      if (a.contestation_id !== v.contestation_id || a.preserved_goal_id !== v.preserved_goal_id || a.hazard_id !== v.hazard_id) throw new Error('Alternative linkage mismatch');
    }
    const open = v.time_to_harm_ticks === null || BigInt(Number(v.round_trip_ticks)) * 4n <= BigInt(Number(v.time_to_harm_ticks));
    if (v.window_open !== open) throw new Error('Window mismatch');
  }
  if (kind === 'observation') {
    const cells = new Set((v.footprint_cells as Json[]).map(canonical));
    const seen = new Set<string>();
    for (const patch of v.belief_patch as ObjectValue[]) {
      const cell = canonical(patch.cell);
      if (!cells.has(cell) || seen.has(cell)) throw new Error('Invalid belief patch footprint');
      seen.add(cell);
    }
  }
  if (kind === 'channel-message') {
    if (hash(v.payload) !== v.payload_hash || Buffer.byteLength(canonical(v.payload)) !== v.payload_bytes) throw new Error('Payload integrity mismatch');
  }
  if (kind === 'channel-message' || kind === 'outbound-intent') {
    const p = v.payload as ObjectValue;
    if (v.payload_kind === 'endpoint-event') {
      validate('endpoint-event', p);
      if (p.occurred_tick !== v.sent_tick) throw new Error('Source tick mismatch');
    } else if (v.payload_kind === 'science-artifact') {
      const bytes = Buffer.from(String(p.content_base64), 'base64');
      const reference = p.reference as ObjectValue;
      if (bytes.toString('base64') !== p.content_base64 || hashBytes(bytes) !== reference.artifact_hash || bytes.length !== reference.byte_length) throw new Error('Artifact integrity mismatch');
    } else if (v.payload_kind === 'observation') validate('observation', p);
    else if (v.payload_kind === 'contestation') validate('contestation', p);
    else if (v.payload_kind === 'cleared-directive' || v.payload_kind === 'directive-revision') validate('directive', p);
    if (v.payload_kind === 'observation-summary' && Buffer.byteLength(canonical(p)) > 4096) throw new Error('Oversized summary');
  }
  if (kind === 'record-event' || kind === 'endpoint-event') {
    const payloadKind = recordPayloads[String(v.event_type)];
    if (!payloadKind || (kind === 'record-event' && v.payload_kind !== payloadKind)) throw new Error('Record payload binding mismatch');
    validate(payloadSchemas[payloadKind]!, v.payload);
    if (kind === 'record-event') {
      if (hash(v.payload) !== v.payload_hash) throw new Error('Record payload hash mismatch');
      if (v.received_tick === null) {
        if (v.occurred_tick !== v.recorded_tick) throw new Error('Local record time mismatch');
      } else if (Number(v.occurred_tick) > Number(v.received_tick) || v.received_tick !== v.recorded_tick) throw new Error('Delivered record time mismatch');
    }
  }
}
