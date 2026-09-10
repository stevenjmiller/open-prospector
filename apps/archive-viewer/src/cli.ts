import { openArchive } from './index.js';
import { serveArchive } from './server.js';

try {
  const [directory, port = '4173', ...extra] = process.argv.slice(2);
  if (!directory || extra.length || !/^\d+$/.test(port)) throw new Error('Usage: npm run viewer -- <campaign-archive> [port]');
  console.log('Verifying campaign archive…');
  const archive = await openArchive(directory);
  const { server, url } = await serveArchive(archive, Number(port));
  console.log(`Verified archive viewer: ${url}\nRead-only. Press Ctrl+C to stop.`);
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
} catch (error) { console.error(String(error)); process.exitCode = 1; }
