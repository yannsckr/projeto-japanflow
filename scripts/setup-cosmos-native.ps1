# Execute a partir da raiz do repositorio develop/cosmos.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'package.json') -or -not (Test-Path 'src-tauri/tauri.conf.json')) {
    throw 'Execute na raiz do JapanFlow apos copiar o patch.'
}
$branch = (git branch --show-current).Trim()
if ($branch -ne 'develop/cosmos') { throw "Branch atual: $branch. Esperada: develop/cosmos." }

# npm v10+; registra script sem substituir scripts existentes.
npm pkg set 'scripts.native:build=vite build --base ./ && node scripts/write-version.mjs'
if ($LASTEXITCODE -ne 0) { throw 'Falha ao registrar native:build' }

npm install --save-dev '@tauri-apps/cli@^2' '@capacitor/cli'
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar ferramentas nativas' }

npm install '@capacitor/core' '@capacitor/android'
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar Capacitor' }

Write-Host 'Dependencias configuradas. Execute npm run native:build antes de sincronizar o Android.' -ForegroundColor Green
Write-Host 'Primeira vez: npx cap add android'
Write-Host 'Depois: npx cap sync android; npx cap open android'
Write-Host 'Windows: npx tauri dev; para instalador: npx tauri build'
