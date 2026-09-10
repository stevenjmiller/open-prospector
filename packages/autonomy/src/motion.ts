import type { Cell } from '@open-prospector/belief';
import { validate } from '@open-prospector/contracts';
import { unsigned } from '@open-prospector/deterministic';
import { LineageBudget } from './budget.js';

export interface EdgeCharge { length_mm: number; energy_units: number }
export interface EdgePose { from_cell: Cell; to_cell: Cell; progress_mm: number }
/** Geometry/policy validates an edge before start; this component only executes its supplied charge. */
export class EdgeMotion {
  #cell: Cell;
  #edge: { to: Cell; charge: EdgeCharge; progress: number } | undefined;
  #lastStepTick = -1;
  constructor(cell: Cell) { validate('common#/$defs/GridCell', cell); this.#cell = { ...cell }; }
  occupancy(): Readonly<Cell> { return Object.freeze({ ...this.#cell }); }
  pose(): Readonly<EdgePose> {
    return Object.freeze({ from_cell: this.occupancy(), to_cell: Object.freeze({ ...(this.#edge?.to ?? this.#cell) }), progress_mm: this.#edge?.progress ?? 0 });
  }
  start(to: Cell, charge: EdgeCharge): void {
    if (this.#edge) throw new Error('Edge already active');
    validate('common#/$defs/GridCell', to);
    const dr = Math.abs(to.row - this.#cell.row), dc = Math.abs(to.column - this.#cell.column);
    if (dr > 1 || dc > 1 || dr + dc === 0 || charge.length_mm !== (dr && dc ? 1414 : 1000)) throw new Error('Invalid adjacent edge');
    unsigned(charge.energy_units);
    this.#edge = { to: { ...to }, charge: { ...charge }, progress: 0 };
  }
  step(tick: number, budget: LineageBudget): Readonly<EdgePose> {
    unsigned(tick);
    if (tick <= this.#lastStepTick) throw new Error('Motion needs a later executing tick');
    if (!this.#edge) throw new Error('No active edge');
    budget.checkExecutionTime(tick);
    const edge = this.#edge;
    const increment = Math.min(100, edge.charge.length_mm - edge.progress);
    budget.debit(tick, { traverse_mm: increment, energy_units: edge.progress === 0 ? edge.charge.energy_units : 0 });
    this.#lastStepTick = tick;
    edge.progress += increment;
    const result = this.pose();
    if (edge.progress === edge.charge.length_mm) { this.#cell = edge.to; this.#edge = undefined; }
    return result;
  }
  /** Authoritative occupancy stays at from_cell; the ledger retains every debit. */
  abandon(): Readonly<Cell> { this.#edge = undefined; return this.occupancy(); }
}
