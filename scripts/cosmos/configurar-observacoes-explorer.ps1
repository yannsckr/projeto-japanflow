# COSMOS - descricoes de pastas no Explorador de Arquivos do Windows.
# Execute na raiz do repositorio JapanFlow.
# Adiciona InfoTip em desktop.ini, sem substituir personalizacoes existentes.
[CmdletBinding(SupportsShouldProcess=$true)]
param()
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  throw 'Execute este script na raiz do JapanFlow (onde existe package.json).'
}

$descriptions = [ordered]@{
  'android' = 'Projeto nativo Android (Capacitor/Gradle). Edite as telas React em src/cosmos/mobile.'
  'src-tauri' = 'Projeto nativo Windows (Tauri/Rust). Edite as telas React em src/cosmos/desktop.'
  'src' = 'Codigo-fonte principal React e TypeScript do JapanFlow.'
  'src/cosmos' = 'Interfaces independentes da COSMOS para Windows e Android.'
  'src/cosmos/mobile' = 'Aplicativo Android COSMOS: navegacao e telas adaptadas por cargo.'
  'src/cosmos/mobile/app' = 'Entrada da aplicacao Android e configuracao das rotas.'
  'src/cosmos/mobile/layouts' = 'Estruturas visuais e navegacao das telas mobile.'
  'src/cosmos/mobile/screens' = 'Telas completas do aplicativo Android.'
  'src/cosmos/mobile/components' = 'Componentes reutilizaveis exclusivos do Android.'
  'src/cosmos/mobile/roles' = 'Experiencias do aplicativo organizadas por cargo e setor.'
  'src/cosmos/mobile/roles/motoboy' = 'Telas do motoboy: corridas, mapa, GPS e comprovantes.'
  'src/cosmos/mobile/roles/expedicao' = 'Telas de expedicao: separacao, conferencia e retiradas.'
  'src/cosmos/mobile/roles/vendas' = 'Telas de vendas: pedidos, acompanhamento e atendimento.'
  'src/cosmos/mobile/roles/administrativo' = 'Telas administrativas do aplicativo Android.'
  'src/cosmos/mobile/hooks' = 'Hooks React especificos das interfaces Android.'
  'src/cosmos/desktop' = 'Aplicativo Windows COSMOS com interface propria.'
  'src/cosmos/desktop/app' = 'Entrada e rotas do aplicativo Windows.'
  'src/cosmos/desktop/layouts' = 'Layouts e navegacao do aplicativo Windows.'
  'src/cosmos/desktop/screens' = 'Telas completas do aplicativo Windows.'
  'src/cosmos/desktop/components' = 'Componentes reutilizaveis exclusivos do Windows.'
  'src/cosmos/shared' = 'Codigo reutilizavel entre as interfaces Windows e Android.'
  'src/cosmos/shared/components' = 'Componentes visuais compartilhados da COSMOS.'
  'src/cosmos/shared/services' = 'Servicos compartilhados; mantenha regras Firebase compativeis com a BOREAL.'
  'src/cosmos/shared/types' = 'Contratos e tipos compartilhados entre plataformas.'
  'src/cosmos/shared/theme' = 'Cores, tipografia e tokens visuais da COSMOS.'
  'src/components' = 'Componentes React existentes, inclusive os usados pela versao web BOREAL.'
  'src/contexts' = 'Contextos globais React, autenticacao e estados compartilhados.'
  'src/hooks' = 'Hooks React existentes, compartilhados com a versao web.'
  'src/lib' = 'Integracoes e servicos existentes, incluindo acesso ao Firebase.'
  'src/pages' = 'Paginas da versao web existentes; preservar compatibilidade BOREAL.'
  'functions' = 'Firebase Cloud Functions do backend compartilhado.'
  'scripts' = 'Automacoes e ferramentas de manutencao do repositorio.'
  'scripts/cosmos' = 'Scripts especificos de build, testes e organizacao da COSMOS.'
  'docs' = 'Documentacao tecnica e operacional do projeto.'
  'docs/cosmos' = 'Documentacao de arquitetura e desenvolvimento da COSMOS.'
  'android/app' = 'Modulo principal Android com recursos nativos e configuracao Gradle.'
  'android/gradle' = 'Gradle Wrapper e arquivos de suporte do projeto Android.'
}

$created = 0
$skipped = 0
foreach ($entry in $descriptions.GetEnumerator()) {
  $folder = Join-Path $root ($entry.Key -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
    Write-Host "IGNORADA (nao existe): $($entry.Key)" -ForegroundColor DarkYellow
    $skipped++
    continue
  }
  $ini = Join-Path $folder 'desktop.ini'
  if (Test-Path -LiteralPath $ini) {
    Write-Host "PRESERVADA (desktop.ini ja existe): $($entry.Key)" -ForegroundColor Yellow
    $skipped++
    continue
  }
  if ($PSCmdlet.ShouldProcess($folder, 'Adicionar InfoTip ao Explorer')) {
    $contents = "[.ShellClassInfo]`r`nInfoTip=$($entry.Value)`r`n"
    [IO.File]::WriteAllText($ini, $contents, [Text.Encoding]::Unicode)
    & attrib.exe +h +s $ini | Out-Null
    & attrib.exe +s $folder | Out-Null
    Write-Host "OK: $($entry.Key)" -ForegroundColor Green
    $created++
  }
}
Write-Host "Concluido: $created descricoes novas; $skipped pastas ausentes ou com configuracao preservada." -ForegroundColor Cyan
Write-Host 'No Explorer: Exibir > Detalhes > clique direito no cabecalho > Mais > Comentarios (se disponivel).'
Write-Host 'Passe o mouse sobre as pastas para testar a descricao. Pode ser necessario atualizar a janela com F5.'
