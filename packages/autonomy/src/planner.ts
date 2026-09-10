import { bresenham, edgeLength, gridCell, octile, validate } from '@open-prospector/contracts';
import { add, ceilDivide, unsigned } from '@open-prospector/deterministic';
import type { Belief, BeliefCell, Cell } from '@open-prospector/belief';

export type Terrain = Pick<Belief, 'cell'>;
export interface Envelope { min_row: number; max_row: number; min_column: number; max_column: number }
export interface RouteLimits { traverse_mm: number; energy_units: number; duration_ticks: number }
export interface Route extends RouteLimits { cells: Cell[]; cost: number }
export interface Edge { length_mm: number; energy_units: number; cost: number; duration_ticks: number; blocked: boolean }
export interface PlanRequest { start: Cell; goal: Cell; envelope: Envelope; limits: RouteLimits }
const directions = [[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]] as const;
function inside(cell: Cell, envelope: Envelope) {
  return cell.row >= envelope.min_row && cell.row <= envelope.max_row && cell.column >= envelope.min_column && cell.column <= envelope.max_column;
}
export function edgeEstimate(terrain: Terrain, from: Cell, to: Cell): Edge {
  const length = edgeLength(from, to), a = terrain.cell(from), b = terrain.cell(to);
  const unknown = !a.known || !b.known;
  const rise = unknown ? 0 : b.elevation_mm - a.elevation_mm;
  const grade = ceilDivide(Math.abs(rise) * 1000, length);
  return { length_mm: length, energy_units: ceilDivide(length, 10) + ceilDivide(Math.max(0, rise), 10), cost: length + (unknown ? 5000 : grade > 250 ? 3000 : 0), duration_ticks: ceilDivide(length, 100), blocked: a.obstacle || b.obstacle || a.geofence || b.geofence || grade > 350 };
}
/** Endpoints do not occlude; elevation occlusion is deliberately absent in v0. */
export function lineOfSight(terrain: Terrain, from: Cell, to: Cell): boolean {
  return bresenham(from, to).slice(1, -1).every(cell => !terrain.cell(cell).obstacle);
}
export function standoffEligible(terrain: Terrain, from: Cell, target: Cell): boolean {
  gridCell(from); gridCell(target);
  return (from.row - target.row) ** 2 + (from.column - target.column) ** 2 <= 400
    && terrain.cell(target).known && lineOfSight(terrain, from, target);
}
export function estimateRoute(terrain: Terrain, cells: readonly Cell[]): Route {
  cells.forEach(gridCell);
  let cost = 0, traverse_mm = 0, energy_units = 0, duration_ticks = 0;
  for (let i = 1; i < cells.length; i++) {
    const edge = edgeEstimate(terrain, cells[i-1]!, cells[i]!);
    cost = add(cost, edge.cost); traverse_mm = add(traverse_mm, edge.length_mm);
    energy_units = add(energy_units, edge.energy_units); duration_ticks = add(duration_ticks, edge.duration_ticks);
  }
  return { cells: cells.map(cell => ({ ...cell })), cost, traverse_mm, energy_units, duration_ticks };
}

interface Label { cell: Cell; g: number; f: number; traverse: number; energy: number; duration: number; ordinal: number; parent: Label | null; stale: boolean }
const compare = (a: Label, b: Label) => a.f - b.f || b.g - a.g || a.cell.row - b.cell.row || a.cell.column - b.cell.column || a.ordinal - b.ordinal;
class Heap {
  #items: Label[] = [];
  push(value: Label) {
    const items = this.#items; let i = items.length; items.push(value);
    while (i) { const p = Math.floor((i - 1) / 2); if (compare(items[p]!, value) <= 0) break; items[i] = items[p]!; i = p; } items[i] = value;
  }
  pop(): Label | undefined {
    const items = this.#items, first = items[0], last = items.pop(); if (!items.length) return first;
    let i = 0;
    while (i * 2 + 1 < items.length) { let c = i * 2 + 1; if (c + 1 < items.length && compare(items[c+1]!, items[c]!) < 0) c++; if (compare(last!, items[c]!) <= 0) break; items[i] = items[c]!; i = c; } items[i] = last!; return first;
  }
}
const dominates = (a: Label, b: Label) => a.g <= b.g && a.traverse <= b.traverse && a.energy <= b.energy && a.duration <= b.duration;

/** A* retains nondominated resource labels so a cheaper but unaffordable prefix
 * cannot erase a feasible route. Equal labels retain first discovery. */
export function planRoute(input: Terrain, request: PlanRequest): Route | null {
  const { start, goal, envelope, limits } = request;
  gridCell(start); gridCell(goal); validate('common#/$defs/GridRectangle', envelope);
  if (envelope.min_row > envelope.max_row || envelope.min_column > envelope.max_column) throw new Error('Inverted envelope');
  unsigned(limits.traverse_mm); unsigned(limits.energy_units); unsigned(limits.duration_ticks);
  const cache = new Map<number, Readonly<BeliefCell>>();
  const terrain: Terrain = { cell(cell) { const key = cell.row * 256 + cell.column; let value = cache.get(key); if (!value) { value = { ...input.cell(cell) }; cache.set(key, value); } return value; } };
  const blocked = (cell: Cell) => !inside(cell, envelope) || terrain.cell(cell).obstacle || terrain.cell(cell).geofence;
  if (blocked(start) || blocked(goal)) return null;
  let ordinal = 0;
  const labels = new Map<number, Label[]>(), heap = new Heap();
  const initial: Label = { cell: { ...start }, g: 0, f: octile(start, goal), traverse: 0, energy: 0, duration: 0, ordinal: ordinal++, parent: null, stale: false };
  labels.set(start.row * 256 + start.column, [initial]); heap.push(initial);
  for (let current = heap.pop(); current; current = heap.pop()) {
    if (current.stale) continue;
    if (current.cell.row === goal.row && current.cell.column === goal.column) {
      const cells: Cell[] = []; for (let step: Label | null = current; step; step = step.parent) cells.push({ ...step.cell }); cells.reverse();
      return { cells, cost: current.g, traverse_mm: current.traverse, energy_units: current.energy, duration_ticks: current.duration };
    }
    for (const [dr, dc] of directions) {
      const next = { row: current.cell.row + dr, column: current.cell.column + dc };
      if (blocked(next)) continue;
      if (dr && dc && (blocked({ row: current.cell.row + dr, column: current.cell.column }) || blocked({ row: current.cell.row, column: current.cell.column + dc }))) continue;
      const edge = edgeEstimate(terrain, current.cell, next); if (edge.blocked) continue;
      const g = add(current.g, edge.cost), h = octile(next, goal);
      const label: Label = { cell: next, g, f: add(g, h), traverse: add(current.traverse, edge.length_mm), energy: add(current.energy, edge.energy_units), duration: add(current.duration, edge.duration_ticks), ordinal: ordinal++, parent: current, stale: false };
      if (label.traverse > limits.traverse_mm || label.energy > limits.energy_units || label.duration > limits.duration_ticks) continue;
      // Safe lower bounds prune impossible suffixes without discarding feasible alternatives.
      if (BigInt(label.traverse) + BigInt(h) > BigInt(limits.traverse_mm) || BigInt(label.energy) + BigInt(ceilDivide(h, 10)) > BigInt(limits.energy_units) || BigInt(label.duration) + BigInt(ceilDivide(h, 100)) > BigInt(limits.duration_ticks)) continue;
      const key = next.row * 256 + next.column, previous = labels.get(key) ?? [];
      if (previous.some(item => !item.stale && dominates(item, label))) continue;
      for (const item of previous) if (dominates(label, item)) item.stale = true;
      labels.set(key, [...previous.filter(item => !item.stale), label]); heap.push(label);
    }
  }
  return null;
}
