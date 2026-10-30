"""Patch C.3 conservador: edita somente o painel existente e evita duplicar a integração."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
p = root / 'src/components/MotoboyTelemetryPanel.tsx'
route = root / 'src/components/MotoboyRouteMap.tsx'
if not route.is_file():
    raise SystemExit('Extraia também src/components/MotoboyRouteMap.tsx')
if not p.is_file():
    raise SystemExit('C.2 ausente: src/components/MotoboyTelemetryPanel.tsx não encontrado.')
s = p.read_text(encoding='utf-8')
new = '<MotoboyRouteMap points={path}/>'
old = '<RouteSketch points={path}/>'
imp = "import { MotoboyRouteMap } from '@/components/MotoboyRouteMap';"
if new in s and imp in s:
    print('C.3 já integrado: nenhuma alteração feita.')
    raise SystemExit(0)
if s.count(old) != 1 or 'function RouteSketch' not in s:
    raise SystemExit('C.2 difere do esperado: painel preservado; envie o arquivo para adaptação.')
s = s.replace(old, new, 1)
if imp not in s: s = imp + '\n' + s
p.write_text(s, encoding='utf-8')
print('C.3 integrado com sucesso. Rode npm install e as validações.')
