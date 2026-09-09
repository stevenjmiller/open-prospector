import { mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, parseCanonical, clone, hash, hashBytes, validate, type ObjectValue, type ChannelProfile, type EndpointEvent, type Json } from '@open-prospector/contracts';
import { Clock, identifier } from '@open-prospector/deterministic';
import { Channel } from '@open-prospector/channel';
import { RecordWriter, verifyFile, type Verification } from '@open-prospector/record';
import { Connection, ProtocolError } from './connection.js';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const endpointPath = fileURLToPath(new URL('../../fleet-endpoint/dist/cli.js', import.meta.url));
export interface Inputs { manifest: ObjectValue; directive: ObjectValue; scenario: ObjectValue; fixture: ObjectValue }
export interface RunOptions { output: string; inputs?: Inputs; fault?: string; watchdogMs?: number }
export interface RunResult { output: string; status: 'completed' | 'failed'; head: string | null; finalStateHash?: string }

export async function defaultInputs(): Promise<Inputs> {
  const read = async (name: string): Promise<ObjectValue> => JSON.parse(await readFile(join(repo, 'fixtures/spine-v0', name + '.json'), 'utf8')) as ObjectValue;
  const [directive, scenario, fixture] = await Promise.all([read('directive'), read('scenario'), read('fixture')]);
  const identity = JSON.parse(await readFile(join(repo, 'artifacts/build-identity.json'), 'utf8')) as ObjectValue;
  const manifest: ObjectValue = {
    schema_version: 'run-manifest-v0', run_id: 'run:spine-v0', compatibility_profile: 'op-jcs-int-v0',
    fixture_id: fixture.fixture_id!, fixture_hash: hash(fixture), scenario_id: scenario.scenario_id!, scenario_hash: hash(scenario),
    directive_id: directive.directive_id!, directive_hash: hash(directive),
    build: { source_revision: identity.source_hash!, source_dirty: false, node_version: '24.12.0', npm_version: '11.6.2', platform: 'portable-node', architecture: 'javascript' },
    versions: { autonomy: 'fake-evidence-spine-v0', terrain_policy: 'terrain.slice-v0', gatekeeper: 'pp.no-go.slice-v0', sensor: 'fake-evidence-spine-v0', body: 'fake-evidence-spine-v0' },
    clock: { tick_ms: 100, start_tick: 0 }, channel: { one_way_latency_ticks: 3000, tier1_bytes_per_tick: 4096, tier2_bytes_per_tick: 1024 },
    prng: { algorithm: 'xoshiro128ss-v1', seed_words: [1, 2, 3, 4] }, recorded_model_results: []
  };
  return { manifest, directive, scenario, fixture };
}
function checkInputs(inputs: Inputs): void {
  validate('run-manifest', inputs.manifest); validate('directive', inputs.directive); validate('spine-scenario', inputs.scenario);
  for (const kind of ['directive', 'scenario', 'fixture'] as const) {
    if (hash(inputs[kind]) !== inputs.manifest[kind + '_hash'] || inputs[kind][kind + '_id'] !== inputs.manifest[kind + '_id']) throw new Error('Input identity mismatch: ' + kind);
  }
  const versions = inputs.manifest.versions as ObjectValue;
  if (versions.body !== 'fake-evidence-spine-v0' || inputs.fixture.implementation !== 'fake-evidence-spine-v0') throw new Error('Unsupported endpoint profile');
}

export async function runSpine(options: RunOptions): Promise<RunResult> {
  const inputs = clone(options.inputs ?? await defaultInputs()); checkInputs(inputs);
  const currentBuild = JSON.parse(await readFile(join(repo, 'artifacts/build-identity.json'), 'utf8')) as ObjectValue;
  if (hash(currentBuild.sources) !== currentBuild.source_hash || currentBuild.source_hash !== (inputs.manifest.build as ObjectValue).source_revision) {
    throw new Error('Replay requires the archived build; current source identity differs');
  }
  const { manifest, directive, scenario, fixture } = inputs;
  const output = resolve(options.output);
  await mkdir(output); // Exclusive run directory: never overwrite an existing archive.
  const fixtureRoot = join(output, 'inputs'); await mkdir(fixtureRoot);
  for (const [kind, value] of Object.entries(inputs)) await writeFile(join(fixtureRoot, kind + '.json'), canonical(value) + '\n');
  const schemaRoot = join(output, 'schemas'); await mkdir(schemaRoot);
  const sourceSchemas = join(repo, 'packages/contracts/schemas');
  for (const name of (await readdir(sourceSchemas)).sort()) await copyFile(join(sourceSchemas, name), join(schemaRoot, name));
  await copyFile(join(repo, 'artifacts/build-identity.json'), join(output, 'build-identity.json'));
  await copyFile(join(repo, 'package-lock.json'), join(output, 'package-lock.json'));
  await writeFile(join(output, 'telemetry.ndjson'), '');
  const runId = String(manifest.run_id), assetId = String(directive.asset_id), directiveId = String(directive.directive_id);
  const clock = new Clock(Number((manifest.clock as ObjectValue).start_tick));
  const channel = new Channel(runId, manifest.channel as unknown as ChannelProfile, clock.tick);
  const record = new RecordWriter(join(output, 'events.ndjson'), runId);
  const append = (type: string, payload: ObjectValue, actor = 'actor:mission-control', subject = runId): void => {
    record.append({ event_type: type, payload, actor_id: actor, subject_id: subject, occurred_tick: clock.tick });
  };
  append('run-started', manifest);
  let connection: Connection | undefined;
  let finalStateHash: string | undefined;
  let terminal = false, acknowledged = false;
  let terminalState = '', assetState = 'idle', terminalReason = '';
  const sourceEvents = new Set<string>();
  const deliveredObservations: ObjectValue[] = [];
  const summaries = new Map<string, ObjectValue>();
  const artifacts = new Map<string, Buffer>();
  try {
    // Only public fake-fixture geofence reaches the gatekeeper. No truth rasters.
    append('directive-submitted', directive, String(directive.author_id), directiveId);
    const target = (directive.target as ObjectValue).cell;
    const rejected = (fixture.geofence_cells as Json[]).some(cell => canonical(cell) === canonical(target));
    append('gatekeeper-evaluated', { directive_id: directiveId, accepted: !rejected, rule_id: 'pp.no-go.slice-v0', evidence_cells: rejected ? [target!] : [] }, 'actor:gatekeeper', directiveId);
    if (rejected) throw new ProtocolError('gatekeeper:rejected');
    const message = channel.enqueue({ direction: 'mission-to-asset', tier: 'tier-1', priority: 220, sent_tick: clock.tick, payload_kind: 'cleared-directive', payload: directive });
    append('directive-transmitted', message as unknown as ObjectValue, 'actor:mission-control', directiveId);
    connection = new Connection(endpointPath, options.watchdogMs ?? 30_000, options.fault ?? 'normal');
    await connection.request({ frame: 'init', run_manifest: manifest, scenario, fixture_root: fixtureRoot });
    while (!terminal || !channel.empty) {
      // This is a harness bound, not an extension of directive authority.
      if (clock.tick >= 100_000) throw new ProtocolError('harness:tick-limit');
      clock.advance();
      const due = channel.deliver(clock.tick);
      for (const message of due.filter(m => m.direction === 'asset-to-mission')) {
        const payload = message.payload;
        if (message.payload_kind === 'endpoint-event') {
          const event = payload as unknown as EndpointEvent;
          if (event.actor_id !== assetId || event.subject_id !== directiveId) throw new ProtocolError('protocol:event-context');
          if (event.event_type === 'directive-received') {
            if (hash(event.payload) !== manifest.directive_hash || acknowledged) throw new ProtocolError('protocol:receipt-mismatch');
            acknowledged = true;
          }
          if (event.event_type === 'endpoint-state-changed') {
            if (!acknowledged || terminal || event.payload.from !== assetState) throw new ProtocolError('protocol:state-context');
            assetState = String(event.payload.to);
            if (['completed', 'failed', 'faulted', 'locked'].includes(assetState)) {
              terminal = true; terminalState = assetState; terminalReason = String(event.payload.reason_code);
            }
          }
          record.append({ ...event, received_tick: clock.tick });
        } else if (message.payload_kind === 'observation-summary') {
          summaries.set(String(payload.observation_id), payload);
          record.append({ event_type: 'observation-summarized', payload, actor_id: assetId, subject_id: String(payload.observation_id),
            occurred_tick: message.sent_tick, received_tick: clock.tick, event_id: identifier(runId, 'message-event', message.sent_tick, message.creation_ordinal) });
        } else if (message.payload_kind === 'observation') {
          if (payload.run_id !== runId || payload.asset_id !== assetId || payload.truth_contact !== false || (payload.belief_patch as Json[]).length) throw new ProtocolError('protocol:fake-observation-context');
          deliveredObservations.push(payload);
          await writeFile(join(output, 'observation.json'), canonical(payload) + '\n');
          append('received-belief-updated', { observer_id: 'observer:mission-control', observation_id: payload.observation_id!, changed_cell_count: 0, belief_state_hash: hash([]) });
        } else if (message.payload_kind === 'science-artifact') {
          const reference = payload.reference as ObjectValue;
          const bytes = Buffer.from(String(payload.content_base64), 'base64');
          artifacts.set(String(reference.artifact_hash), bytes);
          await mkdir(join(output, 'science'), { recursive: true });
          await writeFile(join(output, 'science', String(reference.artifact_hash).slice(7)), bytes, { flag: 'wx' });
        } else throw new ProtocolError('protocol:unsupported-payload');
      }
      const response = await connection.request({ frame: 'advance', to_tick: clock.tick, deliveries: due.filter(m => m.direction === 'mission-to-asset') as unknown as Json });
      const tickIds = new Set<string>();
      for (const intent of response.intents) {
        if (intent.payload_kind === 'endpoint-event') {
          const event = intent.payload as unknown as EndpointEvent;
          if (sourceEvents.has(event.event_id) || tickIds.has(event.event_id)) throw new ProtocolError('protocol:duplicate-source-event');
          tickIds.add(event.event_id);
        }
      }
      channel.enqueueBatch(response.intents); // Only commit after a valid done.
      for (const id of tickIds) sourceEvents.add(id);
    }
    if (terminalState !== 'completed') throw new ProtocolError('endpoint:' + terminalState + ':' + terminalReason);
    if (!acknowledged || deliveredObservations.length !== 1) throw new ProtocolError('evidence:missing-observation');
    const observation = deliveredObservations[0]!;
    const summary = summaries.get(String(observation.observation_id));
    const fullReference = (summary?.artifact_refs as ObjectValue[] | undefined)?.find(r => r.media_type === 'application/vnd.openprospector.observation+json');
    if (!fullReference || fullReference.artifact_hash !== hash(observation) || fullReference.byte_length !== Buffer.byteLength(canonical(observation))) throw new ProtocolError('evidence:unbound-observation');
    if (canonical(observation.measurements) !== canonical(fixture.completion_measurements)) throw new ProtocolError('evidence:unexpected-measurement');
    if (!(observation.artifact_refs as Json[]).length) throw new ProtocolError('evidence:missing-reference');
    for (const reference of observation.artifact_refs as ObjectValue[]) {
      const bytes = artifacts.get(String(reference.artifact_hash));
      if (!bytes || hashBytes(bytes) !== reference.artifact_hash || bytes.toString('utf8') !== canonical(observation.measurements)) throw new ProtocolError('evidence:missing-artifact');
    }
    const checkpoint = await connection.request({ frame: 'checkpoint', at_tick: clock.tick });
    finalStateHash = String(checkpoint.frame.state_hash);
    append('checkpoint-created', { at_tick: clock.tick, state_hash: finalStateHash });
    await connection.stop();
    append('run-completed', { terminal_state: 'completed', final_state_hash: finalStateHash, event_chain_head: record.head! });
  } catch (error) {
    if (connection) await connection.abort();
    append('run-failed', { code: error instanceof ProtocolError ? error.code : 'harness:invariant-failure',
      detail: error instanceof ProtocolError ? error.code : 'Run could not be verified; inspect local diagnostics.',
      safe_state: terminal && terminalState !== 'completed' ? 'hold-position' : 'not-applicable' });
    finalStateHash = undefined;
  } finally { record.close(); }
  const verification = await verifyBundle(output);
  await writeFile(join(output, 'verification.json'), JSON.stringify({ status: verification.status, head: verification.head,
    profile: 'fake-evidence-spine-v0', actual_host: { platform: process.platform, architecture: process.arch, node: process.version } }, null, 2) + '\n');
  return { output, status: verification.status === 'completed' ? 'completed' : 'failed', head: verification.head,
    ...(finalStateHash ? { finalStateHash } : {}) };
}

export async function archivedInputs(bundle: string): Promise<Inputs> {
  const values: Partial<Inputs> = {};
  for (const kind of ['manifest', 'directive', 'scenario', 'fixture'] as const) {
    const text = await readFile(join(bundle, 'inputs', kind + '.json'), 'utf8');
    if (!text.endsWith('\n')) throw new Error('Incomplete input artifact');
    values[kind] = parseCanonical(text.slice(0, -1)) as ObjectValue;
  }
  return values as Inputs;
}
export async function verifyBundle(bundle: string): Promise<Verification> {
  const inputs = await archivedInputs(bundle); checkInputs(inputs);
  const buildText = await readFile(join(bundle, 'build-identity.json'), 'utf8');
  if (!buildText.endsWith('\n')) throw new Error('Incomplete build identity');
  const build = parseCanonical(buildText.slice(0, -1)) as ObjectValue;
  if (hash(build.sources) !== build.source_hash || build.source_hash !== (inputs.manifest.build as ObjectValue).source_revision) throw new Error('Archived build identity mismatch');
  const sources = build.sources as ObjectValue;
  const schemaNames = (await readdir(join(bundle, 'schemas'))).sort();
  const expectedSchemaNames = Object.keys(sources).filter(n => n.startsWith('design/contracts/v0/') && n.endsWith('.schema.json')).map(n => n.slice('design/contracts/v0/'.length)).sort();
  if (canonical(schemaNames) !== canonical(expectedSchemaNames)) throw new Error('Archived schema inventory mismatch');
  for (const name of schemaNames) {
    if ((await readFile(join(bundle, 'schemas', name), 'utf8')).replace(/\r\n/g, '\n') !== sources['design/contracts/v0/' + name]) throw new Error('Archived schema mismatch');
  }
  if ((await readFile(join(bundle, 'package-lock.json'), 'utf8')).replace(/\r\n/g, '\n') !== sources['package-lock.json']) throw new Error('Archived dependency lock mismatch');
  const verification = verifyFile(join(bundle, 'events.ndjson'));
  if (hash(verification.events[0]?.payload) !== hash(inputs.manifest)) throw new Error('Bundle manifest mismatch');
  if (verification.status === 'completed') {
    const text = await readFile(join(bundle, 'observation.json'), 'utf8');
    if (!text.endsWith('\n')) throw new Error('Incomplete observation artifact');
    const observation = parseCanonical(text.slice(0, -1)) as ObjectValue;
    validate('observation', observation);
    if (observation.run_id !== inputs.manifest.run_id || observation.asset_id !== inputs.directive.asset_id || observation.truth_contact !== false) throw new Error('Observation context mismatch');
    const summary = verification.events.find(e => e.event_type === 'observation-summarized' && e.payload.observation_id === observation.observation_id);
    const fullReference = (summary?.payload.artifact_refs as ObjectValue[] | undefined)?.find(r => r.media_type === 'application/vnd.openprospector.observation+json');
    if (!summary || summary.payload.observed_tick !== observation.observed_tick || !fullReference || fullReference.artifact_hash !== hash(observation) || fullReference.byte_length !== Buffer.byteLength(canonical(observation))) throw new Error('Unbound observation artifact');
    if (canonical(observation.measurements) !== canonical(inputs.fixture.completion_measurements)) throw new Error('Unexpected fake evidence');
    const updates = verification.events.filter(e => e.event_type === 'received-belief-updated' && e.payload.observation_id === observation.observation_id);
    if (updates.length !== 1) throw new Error('Observation not delivered');
    for (const reference of observation.artifact_refs as ObjectValue[]) {
      const bytes = await readFile(join(bundle, 'science', String(reference.artifact_hash).slice(7)));
      if (hashBytes(bytes) !== reference.artifact_hash || bytes.length !== reference.byte_length || bytes.toString('utf8') !== canonical(observation.measurements)) throw new Error('Invalid science evidence');
    }
    if (!(observation.artifact_refs as Json[]).length) throw new Error('Missing mandatory artifact reference');
  }
  return verification;
}
