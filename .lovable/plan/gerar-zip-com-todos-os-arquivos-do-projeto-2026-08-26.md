# Gerar .zip com todos os arquivos do projeto

## Objetivo
Gerar um arquivo `.zip` único contendo **todos** os arquivos do projeto (código-fonte, configurações, migrations, funções edge, assets públicos) e disponibilizá-lo para download.

## O que será incluído
- `src/` — código-fonte React/TypeScript (components, pages, hooks, lib, contexts, integrations, types, assets)
- `supabase/` — `config.toml`, `functions/` (edge functions) e `migrations/` (SQL)
- `public/` — favicon, manifest, sw.js, robots.txt, imagens
- `.github/workflows/` — pipeline de CI
- `.git/` — histórico e metadados do git
- `dist/` — build gerado (se existir)
- `.workspace/` — dados internos da plataforma
- Arquivos de configuração raiz: `package.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `components.json`, `index.html`, `README.md`, `bun.lock`

## O que será excluído
- `node_modules/` (324 MB de dependências — não é código do projeto)

## Execução
1. Rodar `zip` a partir da raiz do projeto, excluindo apenas `node_modules/`, salvando em `/mnt/documents/projeto-japanflow.zip`.
2. Confirmar tamanho e número de arquivos do `.zip`.
3. Apresentar o arquivo para download.
