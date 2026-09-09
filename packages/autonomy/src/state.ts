/** Section 9 states. Semantic events are emitted only after controller guards pass. */
export type State = 'idle' | 'planning' | 'scheduled' | 'holding' | 'executing' |
  'safe-hold' | 'locked' | 'completed' | 'failed' | 'faulted';

/** Each name includes its Section 9 precondition; this table does not evaluate terrain or authority. */
export type ControllerEvent = 'directive-delivered' | 'safe-plan' | 'alternatives' |
  'critical' | 'accepted-revision' | 'supersession' | 'start' | 'reflex' |
  'safe-replan' | 'success' | 'budget-failure' | 'fault';

const transitions: Readonly<Record<State, Readonly<Partial<Record<ControllerEvent, State>>>>> = {
  idle: { 'directive-delivered': 'planning', 'budget-failure': 'failed', fault: 'faulted' },
  planning: { 'safe-plan': 'scheduled', alternatives: 'holding', critical: 'locked', 'budget-failure': 'failed', fault: 'faulted' },
  scheduled: { start: 'executing', 'budget-failure': 'failed', fault: 'faulted' },
  holding: { 'accepted-revision': 'planning', supersession: 'planning', 'budget-failure': 'failed', fault: 'faulted' },
  executing: { reflex: 'safe-hold', alternatives: 'holding', critical: 'locked', success: 'completed', 'budget-failure': 'failed', fault: 'faulted' },
  'safe-hold': { 'safe-replan': 'executing', alternatives: 'holding', critical: 'locked', 'budget-failure': 'failed', fault: 'faulted' },
  locked: {}, completed: {}, failed: {}, faulted: {},
};

export function isTerminal(state: State): boolean {
  return state === 'locked' || state === 'completed' || state === 'failed' || state === 'faulted';
}

export function transition(state: State, event: ControllerEvent): State {
  const edges = Object.hasOwn(transitions, state) ? transitions[state] : undefined;
  const next = edges && Object.hasOwn(edges, event) ? edges[event] : undefined;
  if (next === undefined) throw new Error(`Invalid controller transition: ${state} / ${event}`);
  return next;
}
