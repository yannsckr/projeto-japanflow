"""Hotfix conservador para hooks do JapanFlow.

Execute na raiz do projeto com:
    py -3 scripts/corrigir-hooks-19.py

Se o trecho nao for encontrado de forma inequivoca, o arquivo nao e alterado.
"""
from pathlib import Path
import re

# Este script fica em japanflow/scripts/.
ROOT = Path(__file__).resolve().parent.parent


def fix_calendar():
    p = ROOT / 'src/components/EmployeeCalendar.tsx'
    if not p.is_file():
        print(f'CALENDARIO: arquivo nao encontrado: {p}')
        return

    s = p.read_text(encoding='utf-8')
    # Identifica efeitos simples que terminam em `}, [dependencias]);`.
    # Evita modificar codigo quando ha mais de um candidato.
    rx = re.compile(
        r'(useEffect\(\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[)([^\]]*)(\]\s*\)\s*;)',
        re.MULTILINE,
    )
    candidates = []
    for match in rx.finditer(s):
        body = match.group(0).split('}, [')[0]
        deps = [d.strip() for d in match.group(2).split(',') if d.strip()]
        if re.search(r'\buserId\b', body) and 'userId' not in deps:
            candidates.append(match)

    if len(candidates) != 1:
        print(f'CALENDARIO: {len(candidates)} candidatos; nenhuma alteracao automatica.')
        return

    match = candidates[0]
    deps_text = match.group(2).strip()
    new_deps = f'{deps_text}, userId' if deps_text else 'userId'
    updated = s[:match.start(2)] + new_deps + s[match.end(2):]
    p.write_text(updated, encoding='utf-8')
    print('CALENDARIO: dependencia userId adicionada.')


def fix_kanban():
    p = ROOT / 'src/components/KanbanBoard.tsx'
    if not p.is_file():
        print(f'KANBAN: arquivo nao encontrado: {p}')
        return

    s = p.read_text(encoding='utf-8')
    if 'const { loading: archiveLoading, error: archiveError' in s:
        print('KANBAN: ja corrigido.')
        return

    # Procura especificamente o useEffect de paginacao do historico.
    rx = re.compile(
        r'(?P<indent>^[ \t]*)useEffect\(\(\)\s*=>\s*\{\s*'
        r'if\s*\(\s*search\.trim\(\)\.length\s*<\s*2\s*\|\|\s*'
        r'archivedHistory\.loading\s*\|\|\s*archivedHistory\.error\s*\|\|\s*'
        r'!archivedHistory\.hasMore\s*\)\s*return;\s*'
        r'void archivedHistory\.loadMore\(\);\s*\}\s*,\s*\[\s*'
        r'search,\s*archivedHistory\.loading,\s*archivedHistory\.error,\s*'
        r'archivedHistory\.hasMore,\s*archivedHistory\.loadMore,?\s*\]\s*\);',
        re.MULTILINE,
    )
    matches = list(rx.finditer(s))
    if len(matches) != 1:
        print(f'KANBAN: {len(matches)} blocos compativeis; nenhuma alteracao automatica.')
        return

    match = matches[0]
    indent = match.group('indent')
    replacement = (
        f'{indent}const {{\n'
        f'{indent}  loading: archiveLoading,\n'
        f'{indent}  error: archiveError,\n'
        f'{indent}  hasMore: archiveHasMore,\n'
        f'{indent}  loadMore: loadMoreArchive,\n'
        f'{indent}}} = archivedHistory;\n'
        f'{indent}useEffect(() => {{\n'
        f'{indent}  if (search.trim().length < 2 || archiveLoading || archiveError || !archiveHasMore) return;\n'
        f'{indent}  void loadMoreArchive();\n'
        f'{indent}}}, [search, archiveLoading, archiveError, archiveHasMore, loadMoreArchive]);'
    )
    p.write_text(s[:match.start()] + replacement + s[match.end():], encoding='utf-8')
    print('KANBAN: efeito de paginacao ajustado.')


if __name__ == '__main__':
    fix_calendar()
    fix_kanban()
