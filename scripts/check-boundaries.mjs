import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
const allowed = {
  contracts: [], deterministic: ['contracts'], channel: ['contracts','deterministic'], record: ['contracts','deterministic'],
  belief: ['contracts','deterministic'], 'simulation-world': ['contracts','deterministic','belief'],
  autonomy: ['contracts','deterministic','belief'],
  'mission-control': ['contracts','deterministic','belief','channel','record'],
  'fleet-endpoint': ['contracts','deterministic','belief','autonomy','simulation-world']
};
export function checkImport(owner, specifier, sourcePath, directory, dependencies) {
  if (specifier.startsWith('@open-prospector/')) {
    const dependency = specifier.slice('@open-prospector/'.length);
    if (!allowed[owner]?.includes(dependency) || !dependencies[specifier]) throw new Error(`${owner} cannot import ${specifier}`);
  } else if (specifier.startsWith('.')) {
    const destination = relative(resolve(directory, 'src'), resolve(dirname(sourcePath), specifier));
    if (destination.startsWith('..') || /^[A-Za-z]:/.test(destination)) throw new Error(`${owner} imports outside its source boundary`);
  } else if (!specifier.startsWith('node:') && !dependencies[specifier.split('/')[0]]) throw new Error(`${owner}: undeclared dependency ${specifier}`);
}
async function inspect(directory, owner, dependencies) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) await inspect(path, owner, dependencies);
    else if (entry.name.endsWith('.ts')) {
      const text = await readFile(path, 'utf8');
      const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
      const workspace = path.slice(0, path.indexOf('/src/'));
      function visit(node) {
        let specifier;
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) specifier = node.moduleSpecifier;
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) specifier = node.arguments[0];
        if (specifier) {
          if (!ts.isStringLiteral(specifier)) throw new Error('Computed import escapes boundary inspection');
          checkImport(owner, specifier.text, path, workspace, dependencies);
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
      if (['contracts','deterministic','channel'].includes(owner) && /\b(?:Date|Math\.random|localeCompare)\b/.test(text)) throw new Error(`${owner}: nondeterministic primitive`);
    }
  }
}
for (const base of ['packages','apps']) {
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = base + '/' + entry.name;
    const pkg = JSON.parse(await readFile(directory + '/package.json', 'utf8'));
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      if (name.startsWith('@open-prospector/') && !allowed[entry.name]?.includes(name.slice('@open-prospector/'.length))) throw new Error('Forbidden dependency: ' + name);
    }
    await inspect(directory + '/src', entry.name, pkg.dependencies ?? {});
  }
}
// Regression checks for the enforcement itself.
for (const specifier of ['@open-prospector/autonomy','../../fleet-endpoint/src/index.js']) {
  let rejected = false;
  try { checkImport('mission-control', specifier, 'apps/mission-control/src/index.ts', 'apps/mission-control', {}); } catch { rejected = true; }
  if (!rejected) throw new Error('Boundary checker failed its negative case');
}
console.log('Architecture imports verified.');
