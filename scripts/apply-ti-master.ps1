$ErrorActionPreference = 'Stop'

Write-Host "`n=== JAPANFLOW: ativando setor TI master ===" -ForegroundColor Cyan

$typesPath = 'src/types/index.ts'
if (-not (Test-Path $typesPath)) {
  throw "Arquivo nao encontrado: $typesPath"
}

$types = Get-Content $typesPath -Raw

if ($types -notmatch "(?m)^\s*\|\s*'ti'\s*;") {
  $types = $types -replace "\|\s*'garantias'\s*;", "| 'garantias'`r`n  | 'ti';"
}

if ($types -notmatch "(?m)^\s*ti:\s*'TI',") {
  $types = $types -replace "(?m)^(\s*)garantias:\s*'Garantias',\s*$", "`$1garantias: 'Garantias',`r`n`$1ti: 'TI',"
}

Set-Content -Path $typesPath -Value $types -Encoding UTF8
Write-Host '[OK] src/types/index.ts atualizado' -ForegroundColor Green

$rulesPath = 'firestore.rules'
if (-not (Test-Path $rulesPath)) {
  throw "Arquivo nao encontrado: $rulesPath"
}

$rules = Get-Content $rulesPath -Raw

if ($rules -notmatch 'function\s+isTiMaster\s*\(\s*\)') {
  $adminPattern = "(?ms)^\s{4}function\s+isAdmin\(\)\s*\{\s*return\s+isActive\(\)\s*&&\s*ownLink\(\)\.role\s*==\s*'admin';\s*\}"

  $masterBlockLines = @(
    '    function currentUserPath() {',
    '      return /databases/$(database)/documents/users/$(ownLink().user_id);',
    '    }',
    '',
    '    function isTiMaster() {',
    '      return isActive()',
    '        && exists(currentUserPath())',
    "        && ('sectors' in get(currentUserPath()).data)",
    "        && get(currentUserPath()).data.sectors.hasAny(['ti']);",
    '    }',
    '',
    '    function isAdmin() {',
    "      return isActive() && (ownLink().role == 'admin' || isTiMaster());",
    '    }'
  )

  $masterBlock = $masterBlockLines -join "`r`n"
  $regex = New-Object System.Text.RegularExpressions.Regex($adminPattern)

  if (-not $regex.IsMatch($rules)) {
    throw 'Bloco isAdmin esperado nao foi encontrado em firestore.rules. O arquivo nao foi alterado para evitar sobrescrever uma versao divergente.'
  }

  $rules = $regex.Replace(
    $rules,
    [System.Text.RegularExpressions.MatchEvaluator]{
      param($match)
      return $masterBlock
    },
    1
  )

  Set-Content -Path $rulesPath -Value $rules -Encoding UTF8
  Write-Host '[OK] firestore.rules atualizado' -ForegroundColor Green
}
else {
  Write-Host '[OK] firestore.rules ja possui TI master' -ForegroundColor Green
}

Write-Host "`nSetor TI master aplicado." -ForegroundColor Cyan
Write-Host 'Proximo passo: Prettier, lint, TypeScript, build e QA.' -ForegroundColor Yellow