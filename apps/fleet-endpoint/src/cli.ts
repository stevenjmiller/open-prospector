import { canonical, FrameDecoder, hash, hashBytes, validate, type ObjectValue, type Json, type Message } from '@open-prospector/contracts';
import { identifier, add } from '@open-prospector/deterministic';
import { implementationVersion } from './index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const decoder = new FrameDecoder();
const mode = process.argv[2] ?? 'normal';
let run = ''; let tick = 0; let ordinal = 0; let directive: ObjectValue | null = null;
let state = 'idle'; let terminalTick: number | null = null;
let fixture: ObjectValue;
const seen = new Set<string>();
const emit = (frame: ObjectValue): void => { validate('ipc-frame', frame); process.stdout.write(canonical(frame) + '\n'); };
function intent(kind: string, payload: ObjectValue, tier = 'tier-1', priority = 230): void {
  emit({ frame: 'emit', intent: { direction: 'asset-to-mission', tier, priority, sent_tick: tick, payload_kind: kind, payload } });
}
function event(type: string, payload: ObjectValue): void {
  intent('endpoint-event', { event_id: identifier(run, 'endpoint-event', tick, ordinal++), occurred_tick: tick,
    actor_id: directive!.asset_id!, subject_id: directive!.directive_id!, event_type: type, payload });
}
function transition(to: string, cause: string): void {
  event('endpoint-state-changed', { asset_id: directive!.asset_id!, from: state, to, cause_id: cause,
    reason_code: 'fake-evidence-spine-v0', budget_used: { duration_ticks: tick, traverse_mm: 0, energy_units: 0, tier2_bytes: 0 } });
  state = to;
}
function completion(): void {
  const observationId = identifier(run, 'observation', tick, 0);
  const measurements = fixture.completion_measurements as Json[];
  const bytes = Buffer.from(canonical(measurements));
  const reference: ObjectValue = { artifact_id: identifier(run, 'artifact', tick, 0), artifact_hash: hashBytes(bytes), media_type: 'application/json', byte_length: bytes.length };
  const observation: ObjectValue = { schema_version: 'observation-v0', observation_id: observationId,
    run_id: run, asset_id: directive!.asset_id!, sensor_id: 'sensor:fake-transport-v0', observed_tick: tick,
    observation_type: 'standoff-image', truth_contact: false, footprint_cells: [{ row: 0, column: 0 }],
    measurements, belief_patch: [], artifact_refs: mode === 'missing-reference' ? [] : [reference] };
  intent('observation-summary', { observation_id: observationId, observation_type: 'standoff-image', observed_tick: tick,
    footprint_hash: hash(observation.footprint_cells), changed_cell_count: 0, hazard_cells: [], artifact_refs: [reference,
      { artifact_id: identifier(run, 'observation-artifact', tick, 0), artifact_hash: hash(observation),
        media_type: 'application/vnd.openprospector.observation+json', byte_length: Buffer.byteLength(canonical(observation)) }] }, 'tier-1', 180);
  intent('observation', observation, 'tier-2', 160);
  if (mode !== 'missing-artifact') intent('science-artifact', { reference, content_base64: bytes.toString('base64') }, 'tier-2', 100);
  transition('completed', observationId); terminalTick = tick;
}
function handle(frame: ObjectValue): void {
  validate('ipc-frame', frame);
  if (frame.frame === 'init') {
    if (run) throw new Error('Duplicate init');
    const manifest = frame.run_manifest as ObjectValue;
    validate('run-manifest', manifest);
    fixture = JSON.parse(readFileSync(join(String(frame.fixture_root), 'fixture.json'), 'utf8')) as ObjectValue;
    if (hash(fixture) !== manifest.fixture_hash || fixture.implementation !== implementationVersion) throw new Error('Fake fixture mismatch');
    run = String(manifest.run_id); tick = Number((manifest.clock as ObjectValue).start_tick);
    if (mode === 'hang-init') return;
    emit({ frame: 'ready', run_id: mode === 'wrong-ready' ? 'run:wrong' : run }); return;
  }
  if (!run) throw new Error('Missing init');
  if (frame.frame === 'advance') {
    if (frame.to_tick !== add(tick, 1)) throw new Error('Nonconsecutive tick');
    tick = Number(frame.to_tick);
    for (const item of frame.deliveries as Json[]) {
      const message = item as unknown as Message;
      validate('channel-message', message);
      if (message.run_id !== run || message.direction !== 'mission-to-asset' || message.deliver_at_tick !== tick || seen.has(message.message_id)) throw new Error('Invalid delivery context');
      seen.add(message.message_id);
      if (terminalTick !== null) continue;
      if (message.payload_kind !== 'cleared-directive' || directive) throw new Error('Unsupported fake command');
      directive = message.payload;
      event('directive-received', directive);
      if (mode === 'crash-after-emit') process.exit(7);
      if (mode === 'malformed-after-emit') { process.stdout.write('{oops}\n'); return; }
      transition('planning', String(directive.directive_id));
      transition('scheduled', String(directive.directive_id));
    }
    if (state === 'scheduled' && frame.deliveries instanceof Array && !frame.deliveries.length) {
      if (mode === 'terminal-failed') { transition('failed', String(directive!.directive_id)); terminalTick = tick; }
      else { transition('executing', String(directive!.directive_id)); completion(); }
    }
    if (mode === 'wrong-done') emit({ frame: 'done', at_tick: tick + 1 });
    else {
      emit({ frame: 'done', at_tick: tick });
      if (mode === 'duplicate-done') emit({ frame: 'done', at_tick: tick });
    }
    return;
  }
  if (frame.frame === 'checkpoint') {
    if (frame.at_tick !== tick) throw new Error('Wrong checkpoint tick');
    emit({ frame: 'checkpoint-result', at_tick: tick,
      state_hash: hash({ implementation: implementationVersion, tick, state, terminal_tick: terminalTick,
        directive_id: directive?.directive_id ?? null, directive_hash: directive ? hash(directive) : null,
        event_ordinal: ordinal, received_message_ids: [...seen].sort() }) }); return;
  }
  if (frame.frame === 'shutdown') {
    emit({ frame: 'stopped', at_tick: mode === 'wrong-stopped' ? tick + 1 : tick }); process.stdin.pause(); process.stdin.destroy(); return;
  }
  throw new Error('Unexpected request');
}
process.stdin.on('data', (chunk: Buffer) => {
  try { for (const frame of decoder.push(chunk)) handle(frame as ObjectValue); }
  catch (error) { process.stderr.write(String(error)); process.exitCode = 2; process.stdin.destroy(); }
});
process.stdin.on('end', () => { try { decoder.end(); } catch { process.exitCode = 2; } });
