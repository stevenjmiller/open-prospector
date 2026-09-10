import { hash } from '@open-prospector/contracts';
export function unsigned(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new Error('Expected unsigned safe integer');
  return value;
}
export function add(a: number, b: number): number { return unsigned(unsigned(a) + unsigned(b)); }
export function ceilDivide(a: number, b: number): number {
  unsigned(a); unsigned(b);
  if (!b) throw new Error('Division by zero');
  return Number((BigInt(a) + BigInt(b) - 1n) / BigInt(b));
}
export function identifier(run: string, kind: string, tick: number, ordinal: number): string {
  unsigned(tick); unsigned(ordinal);
  return kind + ':' + hash([run, kind, tick, ordinal]).slice(7, 31);
}
export class Clock {
  constructor(public tick: number) { unsigned(tick); }
  advance(): number { this.tick = add(this.tick, 1); return this.tick; }
}
/** Integer-only reflex arithmetic. No classifier or model seam is available. */
export function reflexWindow(distance_mm: number, speed_mm_per_tick: number, latency_ticks: number) {
  if (!Number.isSafeInteger(distance_mm) || !Number.isSafeInteger(speed_mm_per_tick) || speed_mm_per_tick < 0
    || !Number.isSafeInteger(latency_ticks) || latency_ticks < 0) throw new Error('Invalid reflex inputs');
  const v = BigInt(speed_mm_per_tick);
  const stopping = v + (v * v + 49n) / 50n;
  if (stopping > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Stopping distance overflow');
  const margin = BigInt(distance_mm) - stopping;
  const ticks = margin <= 0n ? 0n : margin / (v > 0n ? v : 1n);
  return Object.freeze({ distance_mm, speed_mm_per_tick, reaction_ticks: 1, braking_mm_per_tick_squared: 25,
    latency_ticks, stopping_distance_mm: Number(stopping), T: Number(ticks), window_open: 4n * BigInt(latency_ticks) <= ticks });
}
