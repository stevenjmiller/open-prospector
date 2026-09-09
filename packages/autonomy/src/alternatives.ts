import { bresenham, clone, expandAdvisory, gridCell, octile, validate, type ObjectValue } from '@open-prospector/contracts';
import { add, identifier, unsigned } from '@open-prospector/deterministic';
import type { Cell } from '@open-prospector/belief';
import type { BudgetSnapshot } from './budget.js';
import { estimateRoute, lineOfSight, planRoute, type Envelope, type Route, type RouteLimits, type Terrain } from './planner.js';

export interface KnownTarget { entity_id: string; cell: Cell; science_class: string }
export interface PlanningContext { current_cell: Cell; current_tick: number; budget: BudgetSnapshot; targets: readonly KnownTarget[] }
export interface ScheduledRoute { planned_start_tick: number; route: Route }

function settings(input: unknown, context: PlanningContext) {
  validate('directive', input); unsigned(context.current_tick); gridCell(context.current_cell);
  const directive = clone(input) as ObjectValue;
  const budget = context.budget;
  if (budget.directive_id !== directive.directive_id || budget.terminal || budget.usage.duration_ticks !== context.current_tick - budget.submitted_tick) throw new Error('Planning budget identity/time mismatch');
  const start = Math.max(add(context.current_tick, 1), Number(directive.earliest_start_tick));
  const duration = budget.remaining.duration_ticks - (start - context.current_tick);
  const limits: RouteLimits = { traverse_mm: budget.remaining.traverse_mm, energy_units: budget.remaining.energy_units, duration_ticks: Math.max(0, duration) };
  return { directive, start, limits, expired: duration <= 0, envelope: directive.operating_envelope as unknown as Envelope };
}
function catalog(targets: readonly KnownTarget[]): KnownTarget[] {
  const ids = new Set<string>();
  return targets.map(target => {
    validate('common#/$defs/Id', target.entity_id); gridCell(target.cell);
    if (!target.science_class || ids.has(target.entity_id)) throw new Error('Invalid target catalog');
    ids.add(target.entity_id); return clone(target);
  });
}
function requestedTarget(directive: ObjectValue, targets: KnownTarget[]): { cell: Cell; entity: KnownTarget | null } {
  const target = directive.target as ObjectValue;
  if (target.kind === 'cell') return { cell: clone(target.cell) as unknown as Cell, entity: null };
  const entity = targets.find(t => t.entity_id === target.entity_id);
  if (!entity) throw new Error('Target is not in observer catalog');
  return { cell: entity.cell, entity };
}
export function planDirective(terrain: Terrain, input: unknown, context: PlanningContext): ScheduledRoute | null {
  const s = settings(input, context);
  const target = requestedTarget(s.directive, catalog(context.targets));
  if (s.expired) return null;
  const goal = (s.directive.observation_cell as unknown as Cell | undefined) ?? target.cell;
  const route = planRoute(terrain, { start: context.current_cell, goal, envelope: s.envelope, limits: s.limits });
  return route ? { planned_start_tick: s.start, route } : null;
}

/** Structured proposals only. Level selection, acceptance and clearance belong to #7. */
export function proposeAlternatives(terrain: Terrain, input: unknown, context: PlanningContext, identity: { run_id: string; contestation_id: string; hazard_id: string; first_ordinal: number }): ObjectValue[] {
  const s = settings(input, context), targets = catalog(context.targets), target = requestedTarget(s.directive, targets);
  validate('common#/$defs/Id', identity.run_id); validate('common#/$defs/Id', identity.contestation_id); validate('common#/$defs/Id', identity.hazard_id); unsigned(identity.first_ordinal);
  if (s.expired) return [];
  const advisory = (s.directive.advisory_route as unknown as Cell[] | undefined) ?? [];
  const baseline = estimateRoute(terrain, advisory.length ? expandAdvisory(advisory) : bresenham(context.current_cell, target.cell));
  const permitted = s.directive.permitted_substitutions as string[];
  const candidates: { kind: string; route: Route; cell: Cell; entity?: KnownTarget }[] = [];
  if (permitted.includes('vantage') && terrain.cell(target.cell).known) {
    let best: { route: Route; cell: Cell; score: number } | undefined;
    for (let row = Math.max(s.envelope.min_row, target.cell.row - 20); row <= Math.min(s.envelope.max_row, target.cell.row + 20); row++) {
      for (let column = Math.max(s.envelope.min_column, target.cell.column - 20); column <= Math.min(s.envelope.max_column, target.cell.column + 20); column++) {
        const cell = { row, column }, distance = (row - target.cell.row) ** 2 + (column - target.cell.column) ** 2;
        if (distance < 100 || distance > 400 || !lineOfSight(terrain, cell, target.cell)) continue;
        // A geometric lower bound avoids expensive searches that cannot beat the incumbent.
        if (best && octile(context.current_cell, cell) + octile(cell, target.cell) > best.score) continue;
        const route = planRoute(terrain, { start: context.current_cell, goal: cell, envelope: s.envelope, limits: s.limits });
        if (!route) continue;
        const score = route.cost + octile(cell, target.cell);
        if (!best || score < best.score) best = { route, cell, score }; // row/column loop supplies tie order
      }
    }
    if (best) candidates.push({ kind: 'substitute-vantage', route: best.route, cell: best.cell });
  }
  if (permitted.includes('target') && target.entity) {
    let best: { route: Route; entity: KnownTarget } | undefined;
    for (const entity of targets.slice().sort((a,b) => a.entity_id < b.entity_id ? -1 : a.entity_id > b.entity_id ? 1 : 0)) {
      if (entity.entity_id === target.entity.entity_id || entity.science_class !== target.entity.science_class || octile(entity.cell, target.cell) > 250000 || !terrain.cell(entity.cell).known) continue;
      const route = planRoute(terrain, { start: context.current_cell, goal: entity.cell, envelope: s.envelope, limits: s.limits });
      if (route && (!best || route.cost < best.route.cost)) best = { route, entity };
    }
    if (best) candidates.push({ kind: 'substitute-target', route: best.route, cell: best.entity.cell, entity: best.entity });
  }
  const goal = s.directive.goal as ObjectValue;
  return candidates.map((candidate, index) => {
    const delta = { duration_ticks: candidate.route.duration_ticks - baseline.duration_ticks, traverse_mm: candidate.route.traverse_mm - baseline.traverse_mm, energy_units: candidate.route.energy_units - baseline.energy_units, tier2_bytes: 0 };
    const value: ObjectValue = {
      schema_version: 'alternative-v0', alternative_id: identifier(identity.run_id, 'alternative', context.current_tick, add(identity.first_ordinal, index)), contestation_id: identity.contestation_id,
      kind: candidate.kind, preserved_goal_id: goal.goal_id!, hazard_id: identity.hazard_id,
      proposed_cell: { ...candidate.cell }, proposed_route: candidate.route.cells.map(cell => ({ ...cell })),
      ...(candidate.entity ? { proposed_entity_id: candidate.entity.entity_id } : {}),
      budget_delta: delta, requested_evidence: clone(goal.success_evidence!), summary_template_id: candidate.entity ? 'target.slice-v0' : 'vantage.slice-v0',
      summary: candidate.entity
        ? `Target ${candidate.entity.entity_id}: same class ${candidate.entity.science_class}; avoids ${identity.hazard_id}; route ${candidate.route.traverse_mm} mm.`
        : `Vantage ${candidate.cell.row},${candidate.cell.column}: preserves ${String(goal.goal_id)}; avoids ${identity.hazard_id}; +${delta.energy_units} energy.`
    };
    validate('alternative', value); return value;
  });
}
