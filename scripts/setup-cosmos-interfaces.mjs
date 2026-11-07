import { readFileSync, writeFileSync } from 'node:fs';
const file = 'package.json';
const pkg = JSON.parse(readFileSync(file, 'utf8'));
pkg.scripts ??= {};
Object.assign(pkg.scripts, {
  'cosmos:desktop:dev': 'vite --config vite.native.config.ts --port 8081',
  'cosmos:desktop:build':
    'vite build --config vite.native.config.ts && node scripts/finalize-cosmos-build.mjs',
  'cosmos:android:build':
    'cross-env JAPANFLOW_NATIVE_TARGET=android vite build --config vite.native.config.ts && node scripts/finalize-cosmos-build.mjs --android',
  'cosmos:android:sync': 'npm run cosmos:android:build && cap sync android',
});
writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('Scripts COSMOS registrados, preservando os scripts atuais.');
console.log('Android: npm install --save-dev cross-env@^7 (necessário apenas uma vez).');
