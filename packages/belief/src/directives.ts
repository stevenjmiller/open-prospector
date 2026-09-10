import { canonical, clone, expandAdvisory, gridCell, validate, type ObjectValue } from '@open-prospector/contracts';
import type { Cell } from './index.js';

/** Public policy evaluation only: no hazard alternatives or truth capability. */
export function evaluateGatekeeper(input: unknown, publicGeofence: { cell(cell: Cell): { geofence: boolean } }, targets: readonly { entity_id: string; cell: Cell }[]): ObjectValue {
  validate('directive', input);
  const directive = clone(input) as ObjectValue;
  const target = directive.target as ObjectValue;
  let targetCell: Cell;
  if (target.kind === 'cell') targetCell = target.cell as unknown as Cell;
  else {
    const matches = targets.filter(entity => entity.entity_id === target.entity_id);
    if (matches.length !== 1) throw new Error('Gatekeeper requires an unambiguous observer-known target');
    targetCell = matches[0]!.cell;
  }
  const evidence = new Map<number, Cell>();
  const check = (cell: Cell) => {
    gridCell(cell);
    if (publicGeofence.cell(cell).geofence) evidence.set(cell.row * 256 + cell.column, { ...cell });
  };
  check(targetCell);
  if (directive.observation_cell) check(directive.observation_cell as unknown as Cell);
  for (const cell of expandAdvisory((directive.advisory_route ?? []) as unknown as Cell[])) check(cell);
  const envelope = directive.operating_envelope as ObjectValue;
  for (let row = Number(envelope.min_row); row <= Number(envelope.max_row); row++) {
    for (let column = Number(envelope.min_column); column <= Number(envelope.max_column); column++) check({ row, column });
  }
  const result = { directive_id: directive.directive_id!, accepted: evidence.size === 0, rule_id: 'pp.no-go.slice-v0', evidence_cells: [...evidence.entries()].sort(([a], [b]) => a - b).map(([, cell]) => ({ row: cell.row, column: cell.column })) };
  validate('protocol-payload#/$defs/GatekeeperResult', result);
  return result;
}

/** Deterministic transformation; the caller must still validate the stored offer and clearance. */
export function buildAcceptedRevision(previousInput: unknown, alternativeInput: unknown, acceptanceInput: unknown, newDirectiveId: string): ObjectValue {
  validate('directive', previousInput);
  validate('alternative', alternativeInput);
  validate('protocol-payload#/$defs/AlternativeAcceptance', acceptanceInput);
  const previous = clone(previousInput) as ObjectValue;
  const alternative = clone(alternativeInput) as ObjectValue;
  const acceptance = clone(acceptanceInput) as ObjectValue;
  const goal = previous.goal as ObjectValue;
  const permission = alternative.kind === 'substitute-vantage' ? 'vantage' : 'target';
  if (!(previous.permitted_substitutions as string[]).includes(permission)) throw new Error('Alternative substitution not permitted');
  if (alternative.preserved_goal_id !== goal.goal_id || canonical(alternative.requested_evidence) !== canonical(goal.success_evidence)) throw new Error('Alternative does not preserve the directive goal');
  if (acceptance.contestation_id !== alternative.contestation_id || acceptance.alternative_id !== alternative.alternative_id || acceptance.accepted_by !== previous.author_id) throw new Error('Acceptance identity does not match offer or author');
  if (newDirectiveId === previous.directive_id) throw new Error('Revision requires a new directive id');
  const revision: ObjectValue = {
    ...previous, directive_id: newDirectiveId, revision: Number(previous.revision) + 1,
    supersedes_directive_id: previous.directive_id!, accepted_alternative: acceptance,
    observation_cell: alternative.proposed_cell!
  };
  delete revision.source_text;
  delete revision.advisory_route;
  if (alternative.proposed_route !== undefined) revision.advisory_route = alternative.proposed_route;
  if (alternative.kind === 'substitute-target') revision.target = { kind: 'entity', entity_id: alternative.proposed_entity_id! };
  validate('directive', revision);
  return revision;
}

/** Validate against the complete contestation retained when the endpoint entered holding. */
export function validateAcceptedRevision(previousInput: unknown, revisionInput: unknown, offeredContestation: unknown, sentTick: number): void {
  validate('directive', previousInput);
  validate('directive', revisionInput);
  validate('contestation', offeredContestation);
  validate('common#/$defs/Tick', sentTick);
  const previous = previousInput as ObjectValue, revision = revisionInput as ObjectValue, offered = offeredContestation as ObjectValue;
  const acceptance = revision.accepted_alternative as ObjectValue | undefined;
  if (!acceptance) throw new Error('Revision requires acceptance linkage');
  if (offered.level !== 2 || offered.disposition !== 'holding' || offered.directive_id !== previous.directive_id || offered.asset_id !== previous.asset_id || offered.preserved_goal_id !== (previous.goal as ObjectValue).goal_id) throw new Error('Stored contestation does not offer a revision of this directive');
  if (acceptance.contestation_id !== offered.contestation_id || Number(acceptance.accepted_tick) < Number(offered.created_tick) || Number(acceptance.accepted_tick) > sentTick) throw new Error('Acceptance contestation or time mismatch');
  const alternative = (offered.alternatives as ObjectValue[]).find(item => item.alternative_id === acceptance.alternative_id);
  if (!alternative) throw new Error('Acceptance references an unoffered alternative');
  const expected = buildAcceptedRevision(previous, alternative, acceptance, String(revision.directive_id));
  if (canonical(revision) !== canonical(expected)) throw new Error('Revision differs from the stored accepted alternative transformation');
}
