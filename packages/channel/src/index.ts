import { clone, canonical, hash, validate, type ChannelProfile, type Intent, type Message } from '@open-prospector/contracts';
import { add, ceilDivide, identifier, unsigned } from '@open-prospector/deterministic';

interface Entry { message: Message; start: number }
export class Channel {
  private finish: Record<string, number>;
  private queue: Entry[] = [];
  private ordinal = 0;
  constructor(private readonly runId: string, private readonly profile: ChannelProfile, startTick: number) {
    validate('run-manifest#/properties/channel', profile);
    unsigned(startTick);
    this.profile = clone(profile);
    this.finish = { 'tier-1': startTick, 'tier-2': startTick };
  }
  enqueue(input: Intent): Message { return this.enqueueBatch([input])[0]!; }
  /** Validate the whole tick before replacing live queues or consuming ordinals. */
  enqueueBatch(inputs: readonly Intent[]): Message[] {
    const finish = { ...this.finish };
    let ordinal = this.ordinal;
    const entries: Entry[] = [];
    for (const input of inputs) {
      const intent = clone(input);
      if (intent.direction === 'asset-to-mission') validate('outbound-intent', intent);
      unsigned(intent.sent_tick);
      const start = Math.max(intent.sent_tick, finish[intent.tier]!);
      const capacity = intent.tier === 'tier-1' ? this.profile.tier1_bytes_per_tick : this.profile.tier2_bytes_per_tick;
      const payloadBytes = Buffer.byteLength(canonical(intent.payload));
      const end = add(start, Math.max(1, ceilDivide(payloadBytes, capacity)));
      const message: Message = {
        ...intent, schema_version: 'channel-message-v0', run_id: this.runId,
        message_id: identifier(this.runId, 'message', intent.sent_tick, ordinal), creation_ordinal: ordinal,
        deliver_at_tick: add(end, this.profile.one_way_latency_ticks), payload_hash: hash(intent.payload), payload_bytes: payloadBytes
      };
      validate('channel-message', message);
      ordinal = add(ordinal, 1);
      finish[intent.tier] = end;
      entries.push({ message, start });
    }
    this.finish = finish; this.ordinal = ordinal; this.queue.push(...entries);
    return clone(entries.map(e => e.message));
  }
  deliver(tick: number): Message[] {
    unsigned(tick);
    if (this.queue.some(e => e.message.deliver_at_tick < tick)) throw new Error('Missed delivery');
    const due = this.queue.filter(e => e.message.deliver_at_tick === tick);
    this.queue = this.queue.filter(e => e.message.deliver_at_tick !== tick);
    due.sort((a, b) => (a.message.tier < b.message.tier ? -1 : a.message.tier > b.message.tier ? 1 : 0) || a.start - b.start || a.message.creation_ordinal - b.message.creation_ordinal);
    return clone(due.map(e => e.message));
  }
  get empty(): boolean { return this.queue.length === 0; }
}
