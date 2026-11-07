import { copyFileSync, existsSync } from 'node:fs';
const android = process.argv.includes('--android');
const output = android ? 'dist-android' : 'dist-desktop';
const input = `${output}/${android ? 'mobile' : 'desktop'}.html`;
if (!existsSync(input)) throw new Error(`Arquivo de entrada não encontrado: ${input}`);
copyFileSync(input, `${output}/index.html`);
console.log(`Entrada nativa disponível: ${output}/index.html`);
