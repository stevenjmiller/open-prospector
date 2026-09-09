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
