import { mkdir, readdir, copyFile } from 'node:fs/promises';
const source = new URL('../design/contracts/v0/', import.meta.url);
const destination = new URL('../packages/contracts/schemas/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of (await readdir(source)).filter(n => n.endsWith('.schema.json')).sort()) {
  await copyFile(new URL(name, source), new URL(name, destination));
}
