import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { CatalogError, type Catalog } from './catalog.js';

/** Loopback-only, fixed routes, no archive filesystem route and no mutations. */
export async function serveCatalog(catalog: Catalog, port = 4173) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const staticFiles = new Map<string, { bytes: Buffer; type: string }>();
  for (const [route, file, type] of [['/', 'index.html', 'text/html'], ['/viewer.js', 'viewer.js', 'text/javascript'], ['/viewer.css', 'viewer.css', 'text/css']]) {
    staticFiles.set(route!, { bytes: await readFile(new URL('../public/' + file, import.meta.url)), type: type! + '; charset=utf-8' });
  }
  let origin = '';
  const server = createServer(async (req, res) => {
    const send = (status: number, value: Buffer | object, type = 'application/json; charset=utf-8') => {
      let body = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
      res.statusCode = status;
      res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      if (/\bgzip\b/.test(req.headers['accept-encoding'] ?? '') && body.length > 1024) { body = gzipSync(body); res.setHeader('Content-Encoding', 'gzip'); }
      res.setHeader('Vary', 'Accept-Encoding'); res.setHeader('Content-Length', body.length);
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (req.headers.host !== origin.slice('http://'.length) || (req.headers.origin && req.headers.origin !== origin)) { send(403, { error: 'Local viewer origin required.' }); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); send(405, { error: 'Read-only viewer.' }); return; }
    try {
      const url = new URL(req.url ?? '/', origin);
      const file = staticFiles.get(url.pathname);
      if (file && !url.search) { send(200, file.bytes, file.type); return; }
      if (url.pathname === '/api/runs' && !url.search) { send(200, await catalog.list()); return; }
      if (url.pathname === '/api/session') {
        if ([...url.searchParams.keys()].length !== 1 || !url.searchParams.has('run')) { send(400, { error: 'Choose a run from the catalog.' }); return; }
        send(200, await catalog.session(url.searchParams.get('run')!)); return;
      }
      if (url.pathname === '/api/view') {
        const keys = [...url.searchParams.keys()];
        const tick = url.searchParams.get('tick'), observer = url.searchParams.get('observer');
        if (keys.length !== 4 || !['run', 'snapshot', 'tick', 'observer'].every(key => keys.includes(key)) || !/^(0|[1-9]\d*)$/.test(tick ?? '') || (observer !== 'asset' && observer !== 'mission')) {
          send(400, { error: 'Choose a run snapshot, integer tick and observer (asset or mission).' }); return;
        }
        send(200, catalog.view(url.searchParams.get('run')!, url.searchParams.get('snapshot')!, Number(tick), observer)); return;
      }
      send(404, { error: 'Not found.' });
    } catch (error) { send(error instanceof CatalogError ? error.status : 400, { error: error instanceof CatalogError ? error.message : 'Unable to show this request. Choose a tick within the archive, or refresh the catalog.' }); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Viewer address unavailable');
  origin = `http://127.0.0.1:${address.port}`;
  return { server, url: origin };
}
