import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { materializeSynthetic } from '@open-prospector/simulation-world';
import { defaultCampaignInputs, runCampaign } from '@open-prospector/mission-control';
import { openArchive, createCatalog, serveCatalog } from '@open-prospector/archive-viewer';
import type { ObjectValue, Message, RecordEvent } from '@open-prospector/contracts';

test('viewer preserves observer time, refuses damaged archives, and serves only a read-only projection', async t => {
  const root = await mkdtemp(join(tmpdir(), 'op-viewer-'));
  const inputs = await defaultCampaignInputs();
  const fixtureRoot = join(root, 'fixture'); materializeSynthetic(fixtureRoot, inputs.fixture);
  const output = join(root, 'archive');
  assert.equal((await runCampaign({ output, inputs, fixtureRoot })).status, 'completed');
  const archive = await openArchive(output);
  const telemetryText = await readFile(join(output, 'telemetry.ndjson'), 'utf8');
  const telemetry = telemetryText.trimEnd().split('\n').map(line => JSON.parse(line) as Message);
  const eventText = await readFile(join(output, 'events.ndjson'), 'utf8');
  const events = eventText.trimEnd().split('\n').map(line => JSON.parse(line) as RecordEvent);
  const first = telemetry.find(m => m.payload_kind === 'observation')!;
  const summary = telemetry.find(m => m.payload_kind === 'observation-summary' && m.payload.observation_id === first.payload.observation_id)!;
  const observed = Number(first.payload.observed_tick);
  const cell = (first.payload.belief_patch as ObjectValue[]).find(p => p.obstacle === true)!.cell as ObjectValue;
  const index = Number(cell.row) * 256 + Number(cell.column);

  await t.test('Tier-1 arrives before detail; only full delivery changes mission cells', () => {
    assert.ok(summary.deliver_at_tick < first.deliver_at_tick);
    const onboard = archive.view(observed, 'asset');
    assert.equal(onboard.cells[index]!.obstacle, true);
    const before = archive.view(first.deliver_at_tick - 1, 'mission');
    assert.equal(before.cells[index]!.obstacle, false);
    assert.equal(before.observations.length, 0);
    assert.ok(before.events.some(e => e.event_type === 'observation-summarized'));
    const after = archive.view(first.deliver_at_tick, 'mission');
    assert.equal(after.cells[index]!.obstacle, true);
    const update = events.find(e => e.event_type === 'received-belief-updated' && e.payload.observation_id === first.payload.observation_id)!;
    assert.equal(after.belief_hash, update.payload.belief_state_hash);
  });
  await t.test('mission acceptance is not known onboard before the revision arrives', () => {
    const accepted = events.find(e => e.event_type === 'alternative-accepted')!;
    const receipt = events.find(e => e.event_type === 'directive-received' && e.payload.supersedes_directive_id)!;
    assert.ok(accepted.occurred_tick < receipt.occurred_tick);
    assert.ok(archive.view(accepted.occurred_tick, 'mission').events.some(e => e.event_type === 'alternative-accepted'));
    const early = archive.view(receipt.occurred_tick - 1, 'asset');
    assert.ok(!JSON.stringify(early.events).includes('directive:accepted-0'));
    const onTime = archive.view(receipt.occurred_tick, 'asset');
    assert.ok(onTime.events.some(e => e.event_type === 'directive-received' && e.payload.supersedes_directive_id));
  });
  await t.test('science waits for delivery, backward seeks forget later knowledge', () => {
    const science = telemetry.find(m => m.payload_kind === 'observation' && m.payload.observation_type === 'standoff-image')!;
    const late = archive.view(science.deliver_at_tick, 'mission');
    assert.ok(late.observations.some(o => o.observation_type === 'standoff-image'));
    assert.ok(!archive.view(science.deliver_at_tick - 1, 'mission').observations.some(o => o.observation_type === 'standoff-image'));
    const reset = archive.view(0, 'mission');
    assert.equal(reset.counts.obstacles, 0); assert.equal(reset.counts.sensed, 0); assert.equal(reset.observations.length, 0);
    assert.ok(!JSON.stringify(reset).includes('model:stub-rock-v0'));
    assert.ok(!JSON.stringify(reset).includes('hazard:rock-v0'));
    assert.equal(reset.plan, null);
    assert.ok(!Object.hasOwn(reset, 'position'));
    assert.throws(() => archive.view(-1, 'asset'));
    assert.throws(() => archive.view(0.5, 'asset'));
    assert.throws(() => archive.view(archive.session().max_tick + 1, 'mission'));
  });
  await t.test('HTTP refuses raw paths, foreign origins, writes and malformed projections', async () => {
    const catalog = await createCatalog(root);
    const { server, url } = await serveCatalog(catalog, 0);
    try {
      const page = await fetch(url); assert.equal(page.status, 200);
      assert.match(page.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
      assert.match(await page.text(), /<canvas/);
      const listed = await (await fetch(url + '/api/runs')).json() as { runs: { id: string; name: string }[] };
      assert.deepEqual(listed.runs.map(r => r.name), ['archive']);
      const id = listed.runs[0]!.id;
      const opened = await (await fetch(url + '/api/session?run=' + id)).json() as { archive_id: string; snapshot_id: string };
      assert.equal(opened.archive_id, id);
      const prefix = `/api/view?run=${id}&snapshot=${opened.snapshot_id}&`;
      const response = await fetch(url + prefix + 'tick=0&observer=mission');
      assert.equal(response.status, 200);
      const body = await response.text();
      for (const secret of ['truth-elevation', 'truth-obstacles', 'recorded_model_results', 'source_revision', 'hazard:slump-v0']) assert.ok(!body.includes(secret), secret);
      for (const path of ['/fixture/truth-obstacles.u8', '/inputs/scenario.json', '/events.ndjson', '/%2e%2e/package.json']) assert.equal((await fetch(url + path)).status, 404, path);
      assert.equal((await fetch(url + '/api/session?path=../../package.json')).status, 400);
      assert.equal((await fetch(url + '/api/session?run=../../package.json')).status, 404);
      for (const query of ['tick=-1&observer=asset', 'tick=1.1&observer=asset', 'tick=0&observer=truth', 'tick=0&tick=1&observer=asset', 'tick=0&observer=asset&file=x', 'tick=999999&observer=mission']) assert.equal((await fetch(url + prefix + query)).status, 400, query);
      assert.equal((await fetch(url + prefix + 'tick=0&observer=mission', { method: 'POST', body: '{}' })).status, 405);
      assert.equal((await fetch(url + '/api/runs', { headers: { Origin: 'https://example.org' } })).status, 403);
      const foreignHost = await new Promise<number | undefined>((resolve, reject) => { const r = request(url + '/api/runs', { headers: { Host: 'example.org' } }, response => { response.resume(); resolve(response.statusCode); }); r.on('error', reject); r.end(); });
      assert.equal(foreignHost, 403);
      // A second real campaign is created after startup. It shares the internal
      // run ID but has a slower link and later closure; folder identity matters.
      (inputs.manifest.channel as ObjectValue).tier2_bytes_per_tick = 128;
      const second = join(root, 'human-run-2');
      assert.equal((await runCampaign({ output: second, inputs, fixtureRoot })).status, 'completed');
      const refreshed = await (await fetch(url + '/api/runs')).json() as { runs: { id: string; name: string; run_id: string }[] };
      assert.equal(refreshed.runs.length, 2);
      const secondEntry = refreshed.runs.find(r => r.name === 'human-run-2')!;
      assert.notEqual(id, secondEntry.id);
      assert.equal(refreshed.runs[0]!.run_id, refreshed.runs[1]!.run_id);
      const secondOpened = await (await fetch(url + '/api/session?run=' + secondEntry.id)).json() as { archive_id: string; snapshot_id: string; max_tick: number };
      assert.ok(secondOpened.max_tick > archive.session().max_tick);
      assert.equal((await fetch(url + `/api/view?run=${secondEntry.id}&snapshot=${opened.snapshot_id}&tick=0&observer=mission`)).status, 410);
      // The original open snapshot still belongs to the original archive.
      assert.equal((await fetch(url + prefix + 'tick=0&observer=mission')).status, 200);
      // Repeated opens coalesce verification but yield distinct, bounded snapshots.
      const reopened = await Promise.all(Array.from({ length: 5 }, () => catalog.session(id)));
      assert.throws(() => catalog.view(id, reopened[0]!.snapshot_id, 0, 'mission'), /expired/);
      assert.equal(catalog.view(id, reopened[4]!.snapshot_id, 0, 'mission').archive_id, id);
    } finally { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); }
  });
  await t.test('catalog handles empty roots, malformed and unsupported runs, and excludes linked trees', async () => {
    const libraryRoot = join(root, 'library'); await mkdir(libraryRoot);
    const catalog = await createCatalog(libraryRoot);
    assert.deepEqual((await catalog.list()).runs, []);
    const damaged = join(libraryRoot, 'damaged'); await mkdir(join(damaged, 'inputs'), { recursive: true });
    await writeFile(join(damaged, 'inputs', 'manifest.json'), '{');
    const unsupported = join(libraryRoot, 'transport-only'); await mkdir(join(unsupported, 'inputs'), { recursive: true });
    await writeFile(join(unsupported, 'inputs', 'manifest.json'), '{}');
    await writeFile(join(unsupported, 'inputs', 'scenario.json'), '{"schema_version":"spine-scenario-v0"}');
    await symlink(output, join(libraryRoot, 'outside-link'), 'junction');
    const listed = (await catalog.list()).runs;
    assert.deepEqual(listed.map(r => r.kind), ['unreadable', 'unsupported']);
    await assert.rejects(catalog.session(listed[0]!.id), /could not be verified/);
    // Nested archives are discovered, with relative names preserved.
    const nested = join(libraryRoot, 'group', 'nested'); await cp(output, nested, { recursive: true });
    const nestedEntry = (await catalog.list()).runs.find(r => r.name === 'group/nested')!;
    assert.ok(nestedEntry);
    // Adding an external junction after discovery must fail before verification.
    await symlink(fixtureRoot, join(nested, 'linked-extra'), 'junction');
    await assert.rejects(catalog.session(nestedEntry.id), /Linked archive/);
  });
  await t.test('opening rejects incomplete/corrupt input; an open snapshot stays unchanged', async () => {
    await writeFile(join(output, 'telemetry.ndjson'), '{}\n');
    await assert.rejects(openArchive(output));
    assert.equal(archive.view(0, 'mission').counts.obstacles, 0);
    await writeFile(join(output, 'telemetry.ndjson'), telemetryText);
    await writeFile(join(output, 'events.ndjson'), eventText.trimEnd().split('\n').slice(0, -1).join('\n') + '\n');
    await assert.rejects(openArchive(output), /completed campaign/);
    await writeFile(join(output, 'events.ndjson'), eventText);
    await writeFile(join(output, 'fixture', 'truth-obstacles.u8'), Buffer.alloc(65536, 0));
    await assert.rejects(openArchive(output));
  });
});
