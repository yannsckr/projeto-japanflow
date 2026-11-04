/** Auditoria estática sem mutações e sem exibição do conteúdo dos arquivos. */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const skip = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.firebase',
  'coverage',
  '.auth',
  'test-results',
  'playwright-report',
]);
const sourceFiles = [];
const riskyFiles = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const item of entries) {
    const abs = join(dir, item.name);
    const rel = relative(root, abs).replaceAll('\\', '/');
    if (item.isDirectory()) {
      if (item.name === '.auth') riskyFiles.push(rel);
      if (!skip.has(item.name)) await walk(abs);
      continue;
    }
    if (!item.isFile()) continue;
    if (/^\.env(\.|$)|service.?account|credentials.*\.json$|(^|\/)\.auth\//i.test(rel))
      riskyFiles.push(rel);
    if (/\.(tsx?|jsx?|cjs|mjs)$/.test(rel)) sourceFiles.push(abs);
  }
}

await Promise.all(['src', 'functions', 'scripts', 'qa'].map((dir) => walk(join(root, dir))));
const listeners = [];
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  const count = (content.match(/\bonSnapshot\s*\(/g) ?? []).length;
  if (count > 0) listeners.push({ file: relative(root, file).replaceAll('\\', '/'), count });
}
listeners.sort((a, b) => b.count - a.count);
console.log(`Arquivos de código analisados: ${sourceFiles.length}`);
console.log(`Listeners onSnapshot encontrados: ${listeners.reduce((n, row) => n + row.count, 0)}`);
console.log('Maiores concentradores de listeners (revisão manual; não mede consumo real):');
for (const row of listeners.slice(0, 12)) console.log(`  ${row.count}  ${row.file}`);
if (riskyFiles.length) {
  console.warn(
    `ATENÇÃO: ${riskyFiles.length} possíveis arquivos locais sensíveis detectados. Não exporte esses arquivos.`
  );
  // Nomes/valores propositalmente não impressos.
}
console.log('Auditoria apenas informativa: nenhum arquivo alterado ou removido.');
