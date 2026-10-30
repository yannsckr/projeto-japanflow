"""Instala painel C.2 sem depender das classes CSS exatas do mapa.
Nao sobrescreve a pagina; falha de forma segura em estrutura inesperada.
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
p = root / 'src/pages/MotoboyTrackingPage.tsx'
if not p.is_file():
    raise SystemExit(f'Arquivo nao encontrado: {p}')
s = p.read_text(encoding='utf-8')
imp = "import { MotoboyTelemetryPanel, MotoboyDailyReportPanel } from '@/components/MotoboyTelemetryPanel';"
if '<MotoboyTelemetryPanel' in s or '<MotoboyDailyReportPanel' in s:
    if '<MotoboyTelemetryPanel' in s and '<MotoboyDailyReportPanel' in s:
        print('C.2 ja integrado. Nenhuma alteracao necessaria.')
        raise SystemExit(0)
    raise SystemExit('Integracao parcial encontrada. Nada foi alterado; revise a pagina antes de continuar.')

# Precondicoes antes de qualquer gravacao.
if not re.search(r'\bconst\s+sorted\s*=', s) or not re.search(r'\bconst\s+getName\s*=', s):
    raise SystemExit('Nao encontrei sorted e getName: pagina diferente. Nada foi alterado.')
if s.count('</main>') != 1:
    raise SystemExit('Nao identifiquei um unico fechamento </main>. Nada foi alterado.')
if not (root / 'src/components/MotoboyTelemetryPanel.tsx').is_file():
    raise SystemExit('Componente MotoboyTelemetryPanel.tsx ausente. Extraia o ZIP inteiro antes de executar.')

block = '''      {/* C.2: telemetria de corridas e fechamento diario */}
      <MotoboyDailyReportPanel getName={getName} />
      <section className="space-y-5" aria-label="Percursos GPS por motoboy">
        {sorted.map((session) => (
          <MotoboyTelemetryPanel
            key={session.userId}
            userId={session.userId}
            name={getName(session.userId)}
          />
        ))}
      </section>
'''
# Ancora estrutural estavel: inserir antes do fechamento do main da pagina.
s = s.replace('</main>', block + '    </main>', 1)
if imp not in s:
    s = imp + '\n' + s
p.write_text(s, encoding='utf-8')
print('C.2 integrado: relatorio diario e percurso por motoboy adicionados ao MotoboyTrackingPage.tsx')
