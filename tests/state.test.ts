import assert from 'node:assert/strict';
import test from 'node:test';
import { transition, isTerminal, type State, type ControllerEvent } from '@open-prospector/autonomy';

test('every Section 9 state/event pair either transitions exactly or rejects', () => {
  const states: State[] = ['idle', 'planning', 'scheduled', 'holding', 'executing', 'safe-hold', 'locked', 'completed', 'failed', 'faulted'];
  const events: ControllerEvent[] = ['directive-delivered', 'safe-plan', 'alternatives', 'critical', 'accepted-revision', 'supersession', 'start', 'reflex', 'safe-replan', 'success', 'budget-failure', 'fault'];
  // Independent transcription of the specification's positive rows.
  const allowed = new Map<string, State>([
    ['idle/directive-delivered', 'planning'], ['planning/safe-plan', 'scheduled'],
    ['planning/alternatives', 'holding'], ['planning/critical', 'locked'],
    ['holding/accepted-revision', 'planning'], ['holding/supersession', 'planning'],
    ['scheduled/start', 'executing'], ['executing/reflex', 'safe-hold'],
    ['safe-hold/safe-replan', 'executing'], ['safe-hold/alternatives', 'holding'],
    ['safe-hold/critical', 'locked'], ['executing/alternatives', 'holding'],
    ['executing/critical', 'locked'], ['executing/success', 'completed'],
  ]);
  for (const state of ['idle', 'planning', 'scheduled', 'holding', 'executing', 'safe-hold']) {
    allowed.set(`${state}/budget-failure`, 'failed');
    allowed.set(`${state}/fault`, 'faulted');
  }
  for (const state of states) for (const event of events) {
    const expected = allowed.get(`${state}/${event}`);
    if (expected) assert.equal(transition(state, event), expected, `${state}/${event}`);
    else assert.throws(() => transition(state, event), /Invalid controller transition/, `${state}/${event}`);
  }
  for (const state of states) assert.equal(isTerminal(state), ['locked', 'completed', 'failed', 'faulted'].includes(state));
});

test('unknown states, events and prototype names cannot manufacture a transition', () => {
  for (const state of ['unknown', 'toString', '__proto__']) {
    assert.throws(() => transition(state as State, 'fault'), /Invalid controller transition/);
  }
  for (const event of ['release', 'toString', '__proto__', 'constructor']) {
    assert.throws(() => transition('planning', event as ControllerEvent), /Invalid controller transition/);
    assert.throws(() => transition('locked', event as ControllerEvent), /Invalid controller transition/);
  }
});
