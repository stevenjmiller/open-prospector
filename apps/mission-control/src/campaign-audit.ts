import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonical, parseCanonical, hash, hashBytes, validate, validateFixture, readRasterFile, type ObjectValue, type Message, type ChannelProfile, type RecordEvent } from '@open-prospector/contracts';
import { loadMissionFixture, projectScenario, evaluateGatekeeper, validateAcceptedRevision, type Cell } from '@open-prospector/belief';
import { Channel } from '@open-prospector/channel';
import { reflexWindow } from '@open-prospector/deterministic';
import { verifyFile, type Verification } from '@open-prospector/record';
import { verifyArchiveIdentity, type Inputs } from './index.js';

function requireThat(condition: unknown, detail: string): asserts condition { if (!condition) throw new Error('Campaign audit: ' + detail); }
const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);
async function jsonFile(path: string): Promise<ObjectValue> {
  const text = await readFile(path, 'utf8'); requireThat(text.endsWith('\n'), 'incomplete JSON artifact');
  return parseCanonical(text.slice(0, -1)) as ObjectValue;
}
async function messagesFile(path: string): Promise<Message[]> {
  const text = await readFile(path, 'utf8'); requireThat(!text || text.endsWith('\n'), 'truncated telemetry');
  return text ? text.slice(0, -1).split('\n').map(line => { const value = parseCanonical(line); validate('channel-message', value); return value as unknown as Message; }) : [];
}

/** Offline archive verification never calls autonomy, a model, or the simulation adapter. */
export async function verifyCampaign(bundle: string, options: { requireCompletion?: boolean } = {}): Promise<Verification> {
  const inputs = {} as Inputs;
  for (const kind of ['manifest', 'directive', 'scenario', 'fixture'] as const) inputs[kind] = await jsonFile(join(bundle, 'inputs', kind + '.json'));
  validate('run-manifest', inputs.manifest); validate('directive', inputs.directive); validate('scenario', inputs.scenario);
  const fixture = validateFixture(inputs.fixture);
  for (const kind of ['directive', 'scenario', 'fixture'] as const) requireThat(hash(inputs[kind]) === inputs.manifest[kind + '_hash'] && inputs[kind][kind + '_id'] === inputs.manifest[kind + '_id'], 'input identity ' + kind);
  await verifyArchiveIdentity(bundle, inputs);
  requireThat(equal(await jsonFile(join(bundle, 'fixture', 'fixture-manifest.json')), inputs.fixture), 'fixture manifest mismatch');
  for (const layer of fixture.layers) readRasterFile(join(bundle, 'fixture'), layer);
  const result = verifyFile(join(bundle, 'events.ndjson'));
  requireThat(equal(result.events[0]?.payload, inputs.manifest), 'record manifest mismatch');
  requireThat(!options.requireCompletion || result.status !== 'failed', 'failed archive cannot close successfully');
  const complete = result.status === 'completed' || options.requireCompletion === true;
  const events = result.events;
  const messages = await messagesFile(join(bundle, 'telemetry.ndjson'));
  const byOrdinal = [...messages].sort((a, b) => a.creation_ordinal - b.creation_ordinal);
  requireThat(new Set(messages.map(m => m.message_id)).size === messages.length && new Set(messages.map(m => m.creation_ordinal)).size === messages.length, 'duplicate delivered message');
  for (let i = 0; i < messages.length; i++) {
    requireThat(messages[i]!.run_id === inputs.manifest.run_id, 'message run mismatch');
    if (i) requireThat(messages[i]!.deliver_at_tick >= messages[i - 1]!.deliver_at_tick, 'delivery clock moved backward');
  }
  // A completed archive has drained every queue, so every creation ordinal exists.
  // Failed runs may have undelivered messages; available evidence is still checked.
  if (complete) {
    const channel = new Channel(String(inputs.manifest.run_id), inputs.manifest.channel as unknown as ChannelProfile, Number((inputs.manifest.clock as ObjectValue).start_tick));
    for (const [i, message] of byOrdinal.entries()) {
      requireThat(message.creation_ordinal === i, 'missing delivered message');
      if (i) requireThat(message.sent_tick >= byOrdinal[i - 1]!.sent_tick, 'message creation clock moved backward');
      const { direction, tier, priority, sent_tick, payload_kind, payload } = message;
      requireThat(equal(channel.enqueue({ direction, tier, priority, sent_tick, payload_kind, payload }), message), 'channel timing or serialization mismatch');
    }
    const delivered: Message[] = [];
    for (const tick of [...new Set(messages.map(m => m.deliver_at_tick))].sort((a, b) => a - b)) delivered.push(...channel.deliver(tick));
    requireThat(channel.empty && equal(delivered, messages), 'delivery order mismatch');
  }
  const find = (type: string, predicate: (event: RecordEvent) => boolean) => events.filter(e => e.event_type === type && predicate(e));
  const one = (type: string, predicate: (event: RecordEvent) => boolean) => {
    const values = find(type, predicate); requireThat(values.length === 1, 'missing or duplicate ' + type); return values[0]!;
  };
  const projection = projectScenario(inputs.scenario, 'mission');
  const belief = loadMissionFixture(join(bundle, 'fixture'), inputs.fixture, String(inputs.manifest.run_id), String(inputs.directive.asset_id));
  const targets = projection.target_entities as unknown as { entity_id: string; cell: Cell }[];
  const directives = new Map<string, ObjectValue>();
  directives.set(String(inputs.directive.directive_id), inputs.directive);
  one('directive-submitted', e => equal(e.payload, inputs.directive));
  const offers = new Map(events.filter(e => e.event_type === 'contestation-opened').map(e => [String(e.payload.contestation_id), e.payload]));
  for (const event of events.filter(e => e.event_type === 'directive-revised')) {
    const revision = event.payload, previous = directives.get(String(revision.supersedes_directive_id));
    const acceptance = revision.accepted_alternative as ObjectValue;
    requireThat(previous && acceptance, 'revision parent or acceptance missing');
    const offer = offers.get(String(acceptance.contestation_id)); requireThat(offer, 'revision offer missing');
    validateAcceptedRevision(previous, revision, offer, event.occurred_tick);
    const accepted = one('alternative-accepted', e => equal(e.payload, acceptance));
    const offered = one('contestation-opened', e => e.payload.contestation_id === offer.contestation_id);
    requireThat(accepted.occurred_tick === acceptance.accepted_tick && accepted.sequence > offered.sequence && accepted.sequence < event.sequence, 'acceptance causality');
    requireThat(!directives.has(String(revision.directive_id)), 'duplicate revision'); directives.set(String(revision.directive_id), revision);
  }
  for (const directive of directives.values()) {
    const gate = one('gatekeeper-evaluated', e => e.payload.directive_id === directive.directive_id);
    requireThat(equal(gate.payload, evaluateGatekeeper(directive, belief, targets)), 'gatekeeper evidence mismatch');
    const transmitted = find('directive-transmitted', e => (e.payload.payload as ObjectValue).directive_id === directive.directive_id);
    if (gate.payload.accepted === false) requireThat(transmitted.length === 0, 'rejected directive transmitted');
    else if (complete) requireThat(transmitted.length === 1, 'cleared directive not transmitted');
    for (const event of transmitted) requireThat(event.sequence > gate.sequence && equal((event.payload as unknown as Message).payload, directive), 'transmission precedes clearance or changes directive');
  }
  const observations = new Map<string, ObjectValue>();
  const science = new Map<string, Buffer>();
  const boundEvents = new Set<string>();
  for (const message of messages) {
    const p = message.payload;
    if (message.direction === 'mission-to-asset') {
      one('directive-transmitted', e => equal(e.payload, message)); continue;
    }
    if (message.payload_kind === 'endpoint-event') {
      const event = one(String(p.event_type), e => e.event_id === p.event_id);
      requireThat(event.actor_id === inputs.directive.asset_id && event.subject_id === p.subject_id && (event.event_type === 'classifier-result-consumed' || directives.has(event.subject_id) || (!complete && event.subject_id === inputs.directive.asset_id)) && event.occurred_tick === p.occurred_tick && event.occurred_tick === message.sent_tick && event.received_tick === message.deliver_at_tick && equal(event.payload, p.payload), 'endpoint event binding');
      boundEvents.add(event.event_id);
      if (event.event_type === 'directive-received') requireThat(equal(event.payload, directives.get(String(event.payload.directive_id))), 'receipt differs from cleared directive');
    } else if (['contestation', 'observation-summary', 'plan-summary'].includes(message.payload_kind)) {
      const type = message.payload_kind === 'contestation' ? 'contestation-opened' : message.payload_kind === 'plan-summary' ? 'plan-proposed' : 'observation-summarized';
      const event = one(type, e => equal(e.payload, p));
      requireThat(event.occurred_tick === message.sent_tick && event.received_tick === message.deliver_at_tick && event.actor_id === inputs.directive.asset_id, 'delivered evidence event timing'); boundEvents.add(event.event_id);
    } else if (message.payload_kind === 'observation') {
      requireThat(!observations.has(String(p.observation_id)), 'duplicate observation');
      const bytes = await readFile(join(bundle, 'observations', hash(p).slice(7)));
      requireThat(bytes.toString('utf8') === canonical(p), 'observation archive mismatch');
      belief.receive(message, message.deliver_at_tick);
      const update = one('received-belief-updated', e => e.payload.observation_id === p.observation_id);
      requireThat(update.recorded_tick === message.deliver_at_tick && update.payload.belief_state_hash === belief.stateHash() && update.payload.changed_cell_count === (p.belief_patch as ObjectValue[]).length, 'received belief timing or state mismatch');
      observations.set(String(p.observation_id), p);
    } else if (message.payload_kind === 'science-artifact') {
      const reference = p.reference as ObjectValue, bytes = Buffer.from(String(p.content_base64), 'base64');
      requireThat(hashBytes(bytes) === reference.artifact_hash && bytes.length === reference.byte_length && equal(bytes.toString('base64'), p.content_base64), 'science payload mismatch');
      requireThat((await readFile(join(bundle, 'science', String(reference.artifact_hash).slice(7)))).equals(bytes), 'science archive mismatch');
      science.set(String(reference.artifact_hash), bytes);
    }
  }
  for (const event of events.filter(e => ['directive-received', 'endpoint-state-changed', 'classifier-result-consumed', 'endpoint-fault', 'contestation-opened', 'observation-summarized', 'plan-proposed'].includes(e.event_type))) requireThat(boundEvents.has(event.event_id), 'record event without delivered message');
  for (const observation of observations.values()) {
    if (!complete && !find('observation-summarized', e => e.payload.observation_id === observation.observation_id).length) continue;
    const summary = one('observation-summarized', e => e.payload.observation_id === observation.observation_id).payload;
    const cells = [...observation.footprint_cells as ObjectValue[]].sort((a, b) => Number(a.row) - Number(b.row) || Number(a.column) - Number(b.column));
    const reference = (summary.artifact_refs as ObjectValue[]).find(r => r.media_type === 'application/vnd.openprospector.observation+json');
    requireThat(summary.observed_tick === observation.observed_tick && summary.observation_type === observation.observation_type && summary.footprint_hash === hash(cells) && summary.changed_cell_count === (observation.belief_patch as ObjectValue[]).length && reference?.artifact_hash === hash(observation) && reference.byte_length === Buffer.byteLength(canonical(observation)), 'summary does not bind observation');
  }
  const transitions = events.filter(e => e.event_type === 'endpoint-state-changed');
  let state = 'idle', priorBudget: ObjectValue = { duration_ticks: 0, energy_units: 0, traverse_mm: 0, tier2_bytes: 0 };
  const submitted = one('directive-submitted', e => equal(e.payload, inputs.directive)).occurred_tick;
  const edges: Record<string, string[]> = { idle: ['planning', 'failed', 'faulted'], planning: ['scheduled', 'holding', 'locked', 'failed', 'faulted'], scheduled: ['executing', 'failed', 'faulted'], holding: ['planning', 'failed', 'faulted'], executing: ['safe-hold', 'holding', 'locked', 'completed', 'failed', 'faulted'], 'safe-hold': ['executing', 'holding', 'locked', 'failed', 'faulted'] };
  for (const event of transitions) {
    const p = event.payload, budget = p.budget_used as ObjectValue;
    requireThat(p.asset_id === inputs.directive.asset_id && p.from === state && !['completed', 'failed', 'locked', 'faulted'].includes(state), 'state sequence mismatch');
    requireThat(edges[state]?.includes(String(p.to)), 'invalid state transition');
    for (const key of Object.keys(priorBudget)) requireThat(Number(budget[key]) >= Number(priorBudget[key]), 'budget counter decreased');
    if (state === 'holding' || state === 'safe-hold') requireThat(budget.energy_units === priorBudget.energy_units && budget.traverse_mm === priorBudget.traverse_mm, 'motion debited while held');
    requireThat(budget.duration_ticks === event.occurred_tick - submitted, 'duration lineage reset');
    const directive = directives.get(event.subject_id)!;
    if (p.to === 'planning') requireThat(find('directive-received', e => e.payload.directive_id === event.subject_id && e.sequence < event.sequence).length === 1, 'transition before directive receipt');
    if (p.to === 'executing') {
      const plan = one('plan-proposed', e => e.payload.plan_id === p.cause_id);
      requireThat(plan.payload.directive_id === event.subject_id && plan.occurred_tick <= event.occurred_tick && plan.sequence < event.sequence, 'execution missing causal plan');
    }
    if (!['failed', 'faulted'].includes(String(p.to))) for (const key of Object.keys(priorBudget)) requireThat(Number(budget[key]) <= Number((directive.budget as ObjectValue)[key]), 'budget ceiling exceeded');
    if (!['failed', 'faulted'].includes(String(p.to))) requireThat(event.occurred_tick <= Number(directive.deadline_tick), 'execution past directive deadline');
    if (p.to === 'holding' || p.to === 'safe-hold' || p.to === 'locked') {
      const offer = offers.get(String(p.cause_id)); requireThat(offer && offer.directive_id === event.subject_id && offer.created_tick === event.occurred_tick, 'transition missing contestation cause');
      requireThat(offer.level === (p.to === 'holding' ? 2 : p.to === 'safe-hold' ? 0 : 3), 'contestation level differs from state');
    }
    state = String(p.to); priorBudget = budget;
  }
  for (const offer of offers.values()) {
    requireThat(directives.has(String(offer.directive_id)) && offer.asset_id === inputs.directive.asset_id, 'contestation context');
    requireThat(one('gatekeeper-evaluated', e => e.payload.directive_id === offer.directive_id).payload.accepted === true, 'rejected directive generated contestation');
    requireThat(offer.round_trip_ticks === Number((inputs.manifest.channel as ObjectValue).one_way_latency_ticks) * 2, 'contestation latency differs from manifest');
    if (offer.level === 0) {
      const r = offer.reflex_inputs as ObjectValue, window = reflexWindow(Number(r.distance_mm), Number(r.speed_mm_per_tick), Number(offer.round_trip_ticks));
      requireThat(r.speed_mm_per_tick === 100 && !window.window_open && offer.time_to_harm_ticks === window.T && r.stopping_distance_mm === window.stopping_distance_mm && r.reaction_ticks === 1 && r.braking_mm_per_tick2 === 25, 'reflex evidence inconsistent');
    }
    if (complete) {
      const evidence = (offer.evidence as ObjectValue[]).map(ref => {
        const observation = [...observations.values()].find(o => hash(o) === ref.artifact_hash && Buffer.byteLength(canonical(o)) === ref.byte_length);
        requireThat(observation && Number(observation.observed_tick) <= Number(offer.created_tick), 'contestation evidence missing or from future');
        return observation;
      });
      if (offer.time_to_harm_ticks !== null) {
        const contact = evidence.filter(o => o.observation_type === 'obstacle-range' && o.observed_tick === offer.created_tick)
          .flatMap(o => o.measurements as ObjectValue[]).filter(m => m.name === 'distance-to-contact' && m.unit === 'mm');
        requireThat(contact.length === 1 && Number.isSafeInteger(contact[0]!.value) && Number(contact[0]!.value) >= 0, 'runtime contestation lacks contact measurement');
        const window = reflexWindow(Number(contact[0]!.value), 100, Number(offer.round_trip_ticks));
        requireThat(offer.time_to_harm_ticks === window.T && offer.window_open === window.window_open, 'negotiation window differs from measured contact');
        if (offer.level === 0) requireThat((offer.reflex_inputs as ObjectValue).distance_mm === contact[0]!.value, 'reflex distance differs from measured contact');
      }
    }
  }
  const classifierEvents = events.filter(e => e.event_type === 'classifier-result-consumed');
  requireThat(classifierEvents.length <= 1, 'classifier seam consumed more than once');
  for (const event of classifierEvents) {
    requireThat((inputs.manifest.recorded_model_results as ObjectValue[]).some(r => equal(r, event.payload)), 'classifier result not in manifest');
    const before = transitions.filter(t => t.occurred_tick < event.occurred_tick).at(-1);
    requireThat(before?.payload.to === 'safe-hold', 'classifier consumed before reflex stop');
    if (complete) requireThat([...observations.values()].some(o => o.observation_id === event.subject_id && hash({ observation_id: o.observation_id, sensor_id: o.sensor_id, artifact_hash: hash(o) }) === event.payload.input_hash), 'classifier input not bound to observation');
  }
  if (complete) {
    for (const event of events.filter(e => e.event_type === 'directive-transmitted')) requireThat(messages.some(m => m.direction === 'mission-to-asset' && equal(m, event.payload)), 'transmitted command absent from drained telemetry');
    for (const event of events.filter(e => e.event_type === 'observation-summarized' || e.event_type === 'received-belief-updated')) requireThat(observations.has(String(event.payload.observation_id)), 'record references undelivered observation');
    requireThat(state === 'completed', 'closure without endpoint completion');
    const terminal = transitions.at(-1)!;
    const final = observations.get(String(terminal.payload.cause_id)); requireThat(final?.observation_type === 'standoff-image', 'missing final science observation');
    const measurements = final.measurements as ObjectValue[];
    requireThat(new Set(measurements.map(m => m.name)).size === measurements.length, 'duplicate science measurement');
    const get = (name: string, unit: string) => measurements.find(m => m.name === name && m.unit === unit)?.value;
    requireThat(Number.isSafeInteger(get('target_range_mm', 'mm')) && Number(get('target_range_mm', 'mm')) >= 0 && Number(get('target_range_mm', 'mm')) <= 20000 && get('line_of_sight', 'boolean') === true && typeof get('spectral_class', 'class') === 'string' && get('spectral_class', 'class') !== 'indeterminate', 'science goal evidence unsatisfied');
    requireThat((final.artifact_refs as ObjectValue[]).length > 0, 'missing mandatory science reference');
    for (const ref of final.artifact_refs as ObjectValue[]) {
      const bytes = science.get(String(ref.artifact_hash));
      requireThat(bytes?.toString('utf8') === canonical(measurements) && bytes.length === ref.byte_length && messages.some(m => m.payload_kind === 'science-artifact' && equal(m.payload.reference, ref)), 'missing mandatory delivered science');
    }
    const tier2 = messages.filter(m => m.direction === 'asset-to-mission' && m.tier === 'tier-2').reduce((sum, m) => sum + m.payload_bytes, 0);
    requireThat(priorBudget.tier2_bytes === tier2, 'terminal Tier-2 budget does not match emitted bytes');
    const starting = Number((projection.asset as ObjectValue).starting_energy_units);
    requireThat(Number(priorBudget.energy_units) <= starting - Math.ceil(starting / 5), 'terminal energy reserve violated');
    const plan = events.findLast(e => e.event_type === 'plan-proposed' && e.payload.directive_id === terminal.subject_id && e.occurred_tick <= terminal.occurred_tick);
    requireThat(plan, 'completion missing active plan');
    const cell = (plan.payload.route as unknown as Cell[]).at(-1)!;
    requireThat(!belief.cell(cell).obstacle && !belief.cell(cell).geofence && (final.footprint_cells as unknown as Cell[]).some(c => equal(c, cell)), 'final position lacks safe evidence');
    const checkpoint = one('checkpoint-created', () => true);
    requireThat(checkpoint.occurred_tick === checkpoint.payload.at_tick && checkpoint.occurred_tick >= Math.max(terminal.received_tick!, ...messages.map(m => m.deliver_at_tick)), 'checkpoint precedes queue drain');
  }
  return result;
}

export async function auditCampaign(bundle: string): Promise<ObjectValue> {
  const result = await verifyCampaign(bundle);
  const transitions = result.events.filter(e => e.event_type === 'endpoint-state-changed');
  return { profile: 'synthetic-campaign-v0', status: result.status, chain_head: result.head,
    terminal_state: transitions.at(-1)?.payload.to ?? null,
    checkpoint: result.events.findLast(e => e.event_type === 'checkpoint-created')?.payload ?? null,
    transitions: transitions.map(e => ({ ...e.payload, occurred_tick: e.occurred_tick, received_tick: e.received_tick })),
    contestations: result.events.filter(e => e.event_type === 'contestation-opened').map(e => ({ ...e.payload, received_tick: e.received_tick })),
    accepted_alternatives: result.events.filter(e => e.event_type === 'alternative-accepted').map(e => e.payload),
    classifier_results: result.events.filter(e => e.event_type === 'classifier-result-consumed').map(e => e.payload),
    final_received_belief_hash: result.events.findLast(e => e.event_type === 'received-belief-updated')?.payload.belief_state_hash ?? null };
}
