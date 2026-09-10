import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { openArchive, type Archive } from './index.js';

export class CatalogError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export interface RunEntry {
  id: string; name: string; run_id: string | null; fixture_id: string | null;
  modified_at: string | null; kind: 'campaign' | 'unsupported' | 'unreadable';
}

/** Discovery is a metadata preview. Every Open independently verifies the run. */
export async function createCatalog(directory: string) {
  const root = await realpath(resolve(directory));
  if (!(await lstat(root)).isDirectory()) throw new Error('Archive root must be a directory.');
  let paths = new Map<string, string>();
  const snapshots = new Map<string, { run: string; archive: Archive }>();
  const pending = new Map<string, Promise<Archive>>();
  const inside = (path: string) => { const suffix = relative(root, path); return suffix === '' || (!isAbsolute(suffix) && !suffix.startsWith('..' + sep) && suffix !== '..'); };
  const ignored = new Set(['node_modules', '.git', '.venv', 'venv', '__pycache__']);
  async function metadata(path: string) {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1_048_576 || !inside(await realpath(path))) throw new Error('Metadata unavailable');
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  }
  async function list() {
    const discovered = new Map<string, string>();
    const runs: RunEntry[] = [];
    let visited = 0, truncated = false;
    async function scan(path: string, depth: number): Promise<void> {
      if (++visited > 1000) { truncated = true; return; }
      const info = await lstat(path).catch(() => null);
      if (!info?.isDirectory() || info.isSymbolicLink() || !inside(await realpath(path))) return;
      const inputs = await lstat(join(path, 'inputs')).catch(() => null);
      // Never traverse a linked input directory while previewing metadata.
      const manifest = inputs?.isDirectory() && !inputs.isSymbolicLink() ? await lstat(join(path, 'inputs', 'manifest.json')).catch(() => null) : null;
      if (manifest) {
        const name = relative(root, path).split(sep).join('/') || basename(root);
        const id = createHash('sha256').update(name).digest('hex');
        const entry: RunEntry = { id, name, run_id: null, fixture_id: null, modified_at: manifest.mtime.toISOString(), kind: 'unreadable' };
        try {
          const [run, scenario] = await Promise.all([metadata(join(path, 'inputs', 'manifest.json')), metadata(join(path, 'inputs', 'scenario.json'))]);
          entry.run_id = typeof run.run_id === 'string' ? run.run_id.slice(0, 256) : null;
          entry.fixture_id = typeof run.fixture_id === 'string' ? run.fixture_id.slice(0, 256) : null;
          entry.kind = scenario.schema_version === 'scenario-v0' ? 'campaign' : 'unsupported';
        } catch { /* Keep damaged and unfinished archives visible, without trusting them. */ }
        const eventInfo = await lstat(join(path, 'events.ndjson')).catch(() => null);
        if (eventInfo && !eventInfo.isSymbolicLink()) entry.modified_at = eventInfo.mtime.toISOString();
        runs.push(entry); discovered.set(id, path); return;
      }
      const children = await readdir(path, { withFileTypes: true }).catch(() => []);
      for (const child of children) {
        if (!child.isDirectory() || child.isSymbolicLink() || ignored.has(child.name)) continue;
        if (depth >= 4) { truncated = true; continue; }
        if (visited >= 1000) { truncated = true; break; }
        await scan(join(path, child.name), depth + 1);
      }
    }
    await scan(root, 0);
    paths = discovered;
    runs.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    return { root_name: basename(root), runs, truncated };
  }
  async function assertLocalTree(path: string): Promise<void> {
    // Checking ancestors catches a directory replaced by a junction after discovery.
    let ancestor = path;
    while (ancestor !== root) {
      const info = await lstat(ancestor);
      if (info.isSymbolicLink() || !inside(await realpath(ancestor))) throw new Error('Linked archive paths are not supported.');
      const parent = resolve(ancestor, '..'); if (parent === ancestor) throw new Error('Archive outside configured root.'); ancestor = parent;
    }
    async function visit(current: string): Promise<void> {
      for (const item of await readdir(current, { withFileTypes: true })) {
        const next = join(current, item.name), info = await lstat(next);
        if (info.isSymbolicLink() || !inside(await realpath(next))) throw new Error('Linked archive files are not supported.');
        if (info.isDirectory()) await visit(next);
      }
    }
    await visit(path);
  }
  async function session(id: string) {
    const path = paths.get(id);
    if (!path) throw new CatalogError('Run not found. Refresh the run list.', 404);
    let loading = pending.get(id);
    if (!loading) {
      loading = (async () => { await assertLocalTree(path); const archive = await openArchive(path); await assertLocalTree(path); return archive; })();
      pending.set(id, loading);
    }
    try {
      const archive = await loading;
      const snapshotId = randomUUID();
      snapshots.set(snapshotId, { run: id, archive });
      while (snapshots.size > 4) snapshots.delete(snapshots.keys().next().value!);
      return { ...archive.session(), archive_name: relative(root, path).split(sep).join('/') || basename(root), archive_id: id, snapshot_id: snapshotId };
    } catch (error) {
      throw new CatalogError('This run could not be verified. It may be incomplete or damaged. ' + (error instanceof Error ? error.message.slice(0, 240) : ''), 422);
    } finally { if (pending.get(id) === loading) pending.delete(id); }
  }
  function view(id: string, snapshotId: string, tick: number, observer: 'asset' | 'mission') {
    const snapshot = snapshots.get(snapshotId);
    if (!snapshot || snapshot.run !== id) throw new CatalogError('This run snapshot has expired. Open the run again.', 410);
    // LRU keeps the actively viewed snapshot even if other tabs open runs.
    snapshots.delete(snapshotId); snapshots.set(snapshotId, snapshot);
    return { ...snapshot.archive.view(tick, observer), archive_id: id, snapshot_id: snapshotId };
  }
  await list();
  return { list, session, view };
}

export type Catalog = Awaited<ReturnType<typeof createCatalog>>;
