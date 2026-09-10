import { createCatalog } from './catalog.js';
import { serveCatalog } from './server.js';

try {
  const [directory = 'artifacts', port = '4173', ...extra] = process.argv.slice(2);
  if (extra.length || !/^\d+$/.test(port)) throw new Error('Usage: npm run viewer -- [archive-root] [port]');
  const catalog = await createCatalog(directory);
  const { server, url } = await serveCatalog(catalog, Number(port));
  console.log(`Campaign run library: ${url}\nArchive root: ${directory}\nChoose a run in the browser; each run is verified on opening. Refresh finds new runs.\nRead-only. Press Ctrl+C to stop.`);
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
} catch (error) { console.error(String(error)); process.exitCode = 1; }
