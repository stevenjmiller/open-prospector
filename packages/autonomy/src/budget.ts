import { canonical, clone, validate, type ObjectValue } from '@open-prospector/contracts';
import { add, ceilDivide, unsigned } from '@open-prospector/deterministic';

export interface BudgetUsage { duration_ticks: number; traverse_mm: number; energy_units: number; tier2_bytes: number }
export type BudgetDebit = Partial<Omit<BudgetUsage, 'duration_ticks'>>;
export interface BudgetSnapshot {
  original_directive_id: string; directive_id: string; revision: number; submitted_tick: number; terminal: boolean;
  starting_energy_units: number; reserve_energy_units: number; available_energy_units: number;
  usage: Readonly<BudgetUsage>; ceilings: Readonly<BudgetUsage>; remaining: Readonly<BudgetUsage>;
}
export class BudgetExceeded extends Error {
  constructor(readonly counter: keyof BudgetUsage | 'deadline_tick', readonly usage: Readonly<BudgetUsage>) {
    super(`budget:${counter}`);
  }
}
export class ReserveExceeded extends Error { constructor() { super('energy-reserve'); } }
const preserved = ['campaign_id', 'asset_id', 'author_id', 'goal', 'operating_envelope', 'permitted_substitutions', 'budget', 'earliest_start_tick', 'deadline_tick', 'safe_idle'] as const;

/** One ledger per original directive. Replanning and holds never replace this object. */
export class LineageBudget {
  readonly #original: ObjectValue;
  #current: ObjectValue;
  readonly #submitted: number;
  readonly #startingEnergy: number;
  readonly #ceilings: BudgetUsage;
  #spent = { traverse_mm: 0, energy_units: 0, tier2_bytes: 0 };
  #lastTick: number;
  #lastSentTick: number;
  #terminalTick: number | undefined;
  readonly #ids = new Set<string>();
  constructor(original: unknown, submittedTick: number, startingEnergy: number) {
    validate('directive', original);
    const directive = clone(original) as ObjectValue;
    if (directive.revision !== 0 || (directive.supersedes_directive_id !== null && directive.supersedes_directive_id !== undefined) || directive.accepted_alternative !== undefined) throw new Error('Expected original directive');
    this.#submitted = unsigned(submittedTick);
    this.#startingEnergy = unsigned(startingEnergy);
    this.#original = directive;
    this.#current = clone(directive);
    this.#ceilings = clone(directive.budget) as unknown as BudgetUsage;
    this.#lastTick = submittedTick;
    this.#lastSentTick = submittedTick;
    this.#ids.add(String(directive.directive_id));
  }
  #usage(tick: number): Readonly<BudgetUsage> {
    return Object.freeze({ duration_ticks: (this.#terminalTick ?? tick) - this.#submitted, ...this.#spent });
  }
  #time(tick: number): void {
    unsigned(tick);
    if (tick < this.#lastTick) throw new Error('Budget time reversed');
    if (this.#terminalTick !== undefined) throw new Error('Budget is terminal');
    this.#lastTick = tick;
    if (tick - this.#submitted >= this.#ceilings.duration_ticks) this.#fail('duration_ticks', tick);
    if (tick >= Number(this.#original.deadline_tick)) this.#fail('deadline_tick', tick);
  }
  #fail(counter: keyof BudgetUsage | 'deadline_tick', tick: number): never {
    this.#terminalTick = tick;
    throw new BudgetExceeded(counter, this.#usage(tick));
  }
  checkTime(tick: number): void {
    this.#time(tick);
  }
  checkExecutionTime(tick: number): void {
    this.#time(tick);
    if (tick < Number(this.#original.earliest_start_tick)) throw new Error('Directive has not reached earliest start');
  }
  snapshot(tick: number): Readonly<BudgetSnapshot> {
    unsigned(tick);
    if (tick < this.#lastTick) throw new Error('Budget time reversed');
    const usage = this.#usage(tick);
    const reserve = ceilDivide(this.#startingEnergy, 5);
    return Object.freeze({
      original_directive_id: String(this.#original.directive_id), directive_id: String(this.#current.directive_id), revision: Number(this.#current.revision),
      submitted_tick: this.#submitted, terminal: this.#terminalTick !== undefined,
      starting_energy_units: this.#startingEnergy, reserve_energy_units: reserve,
      available_energy_units: this.#startingEnergy - reserve - usage.energy_units,
      usage, ceilings: Object.freeze({ ...this.#ceilings }),
      remaining: Object.freeze({
        duration_ticks: Math.max(0, Math.min(this.#ceilings.duration_ticks - usage.duration_ticks, Number(this.#original.deadline_tick) - (this.#terminalTick ?? tick))),
        traverse_mm: this.#ceilings.traverse_mm - usage.traverse_mm,
        energy_units: Math.min(this.#ceilings.energy_units - usage.energy_units, this.#startingEnergy - reserve - usage.energy_units),
        tier2_bytes: this.#ceilings.tier2_bytes - usage.tier2_bytes
      })
    });
  }
  debit(tick: number, debit: BudgetDebit): Readonly<BudgetUsage> {
    this.checkTime(tick);
    for (const key of Object.keys(debit)) if (!['traverse_mm', 'energy_units', 'tier2_bytes'].includes(key)) throw new Error('Unknown budget debit');
    const next = { ...this.#spent };
    for (const key of ['traverse_mm', 'energy_units', 'tier2_bytes'] as const) {
      const amount = unsigned(debit[key] ?? 0);
      // Compare before addition so an overflowing prospective sum still fails as a budget ceiling.
      if (amount > this.#ceilings[key] - next[key]) this.#fail(key, tick);
      next[key] = add(next[key], amount);
    }
    if (next.energy_units > this.#startingEnergy - ceilDivide(this.#startingEnergy, 5)) throw new ReserveExceeded();
    this.#spent = next;
    return this.#usage(tick);
  }
  reserveTier2(tick: number, kind: 'observation' | 'science-artifact', payload: ObjectValue): number {
    this.checkTime(tick);
    if (kind !== 'observation' && kind !== 'science-artifact') throw new Error('Not a budgeted Tier-2 payload');
    validate('outbound-intent', { direction: 'asset-to-mission', tier: 'tier-2', priority: kind === 'observation' ? 160 : 100, sent_tick: tick, payload_kind: kind, payload });
    if (kind === 'observation' && (payload.asset_id !== this.#original.asset_id || Number(payload.observed_tick) > tick)) throw new Error('Observation identity/time mismatch');
    const bytes = Buffer.byteLength(canonical(payload), 'utf8');
    this.debit(tick, { tier2_bytes: bytes });
    return bytes;
  }
  revise(input: unknown, sentTick: number): void {
    unsigned(sentTick);
    if (this.#terminalTick !== undefined) throw new Error('Budget is terminal');
    validate('directive', input);
    const revision = clone(input) as ObjectValue;
    if (sentTick < this.#lastSentTick || revision.supersedes_directive_id !== this.#current.directive_id || revision.revision !== Number(this.#current.revision) + 1 || this.#ids.has(String(revision.directive_id))) throw new Error('Invalid directive lineage');
    for (const key of preserved) if (canonical(revision[key]) !== canonical(this.#original[key])) throw new Error(`Revision changed ${key}`);
    this.#current = revision;
    this.#lastSentTick = sentTick;
    this.#ids.add(String(revision.directive_id));
  }
  /** Call after the final operation succeeds; subsequent snapshots retain terminal counters. */
  finish(tick: number): Readonly<BudgetUsage> {
    this.#time(tick);
    this.#terminalTick = tick;
    return this.#usage(tick);
  }
}
