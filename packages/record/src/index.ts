import { openSync, writeSync, fsyncSync, closeSync, readFileSync } from 'node:fs';
import { canonical, parseCanonical, hash, validate, recordPayloads, type ObjectValue, type RecordEvent } from '@open-prospector/contracts';
import { identifier, unsigned } from '@open-prospector/deterministic';

export interface EventInput {
  event_type: string; payload: ObjectValue; actor_id: string; subject_id: string;
  occurred_tick: number; received_tick?: number | null; event_id?: string;
}
export class RecordWriter {
  private fd: number;
  private events: RecordEvent[] = [];
  private closed = false;
  private missionOrdinal = 0;
  constructor(readonly path: string, readonly runId: string) { this.fd = openSync(path, 'wx'); }
  get head(): string | null { return this.events.at(-1)?.event_hash ?? null; }
  append(input: EventInput): RecordEvent {
    if (this.closed) throw new Error('Record is closed');
    const sequence = this.events.length;
    const received = input.received_tick ?? null;
    const unsignedEvent = {
      schema_version: 'record-event-v0' as const, run_id: this.runId, sequence,
      event_id: input.event_id ?? identifier(this.runId, 'mission-event', input.occurred_tick, this.missionOrdinal),
      occurred_tick: input.occurred_tick, received_tick: received, recorded_tick: received ?? input.occurred_tick,
      event_type: input.event_type, actor_id: input.actor_id, subject_id: input.subject_id,
      payload_kind: recordPayloads[input.event_type]!, payload_hash: hash(input.payload), payload: input.payload,
      prev_event_hash: this.head
    };
    const event: RecordEvent = { ...unsignedEvent, event_hash: hash(unsignedEvent) };
    validateAppend(this.events, event, this.runId);
    const bytes = Buffer.from(canonical(event) + '\n');
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const written = writeSync(this.fd, bytes, offset, bytes.length - offset);
        if (!written) throw new Error('Short record write');
        offset += written;
      }
      fsyncSync(this.fd);
    } catch (error) {
      // Retain a potentially partial append as evidence, and forbid further writes.
      this.close(); throw error;
    }
    this.events.push(parseCanonical(canonical(event)) as unknown as RecordEvent);
    if (input.event_id === undefined) this.missionOrdinal++;
    return event;
  }
  close(): void { if (!this.closed) { this.closed = true; closeSync(this.fd); } }
}

function validateAppend(events: readonly RecordEvent[], event: RecordEvent, runId: string): void {
  validate('record-event', event);
  unsigned(event.recorded_tick);
  const previous = events.at(-1);
  if (previous && ['run-completed', 'run-failed'].includes(previous.event_type)) throw new Error('Event after closure');
  if (!previous && event.event_type !== 'run-started') throw new Error('Missing run-started');
  if (previous && event.event_type === 'run-started') throw new Error('Duplicate run-started');
  if (event.run_id !== runId || event.sequence !== events.length || event.prev_event_hash !== (previous?.event_hash ?? null)) throw new Error('Broken record sequence');
  if (previous && previous.recorded_tick > event.recorded_tick) throw new Error('Record clock moved backward');
  if (events.some(e => e.event_id === event.event_id)) throw new Error('Duplicate event id');
  const { event_hash, ...body } = event;
  if (hash(body) !== event_hash) throw new Error('Invalid event hash');
  if (event.event_type === 'run-started' && event.payload.run_id !== runId) throw new Error('Manifest/run mismatch');
  if (event.event_type === 'run-completed') {
    if (event.payload.event_chain_head !== event.prev_event_hash || event.payload.terminal_state !== 'completed') throw new Error('Invalid run closure');
    const checkpoint = events.findLast(e => e.event_type === 'checkpoint-created');
    if (!checkpoint || checkpoint.payload.state_hash !== event.payload.final_state_hash) throw new Error('Missing closure checkpoint');
  }
}
export interface Verification { status: 'completed' | 'failed' | 'incomplete'; head: string | null; events: RecordEvent[] }
export function verifyText(text: string): Verification {
  if (text && !text.endsWith('\n')) throw new Error('Truncated record line');
  const lines = text ? text.slice(0, -1).split('\n') : [];
  const events: RecordEvent[] = [];
  let runId = '';
  for (const line of lines) {
    const event = parseCanonical(line) as unknown as RecordEvent;
    if (!events.length) runId = event.run_id;
    validateAppend(events, event, runId);
    events.push(event);
  }
  const last = events.at(-1);
  return { status: last?.event_type === 'run-completed' ? 'completed' : last?.event_type === 'run-failed' ? 'failed' : 'incomplete', head: last?.event_hash ?? null, events };
}
export function verifyFile(path: string): Verification {
  const bytes = readFileSync(path);
  return verifyText(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
}
