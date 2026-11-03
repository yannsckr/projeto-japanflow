from pathlib import Path
p = Path('src/pages/ReferencesPage.tsx')
s = p.read_text(encoding='utf-8')
import_line = "import { Reference3DExplorer } from '@/components/references/Reference3DExplorer';\n"
if import_line not in s:
    anchor = "import { Input } from '@/components/ui/input';\n"
    if s.count(anchor) != 1: raise SystemExit('Import esperado não encontrado; arquivo preservado.')
    s = s.replace(anchor, anchor + import_line, 1)
anchor = '''          {error && (
            <p role="alert" className="text-destructive">'''
insertion = '''          <Reference3DExplorer
            brand={brand}
            references={items.map((item) => ({
              id: item.id,
              name: item.name,
              partType: item.partType,
              description: item.description,
            }))}
            onChooseReference={(id) => {
              setSelected(id);
              document.getElementById('reference-catalog-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
'''
if insertion not in s:
    if s.count(anchor) != 1: raise SystemExit('Ponto de inserção não encontrado ou ambíguo; arquivo preservado.')
    s = s.replace(anchor, insertion + anchor, 1)
# Give visual target a unique id for the scroll.
target = '''          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">'''
if 'id="reference-catalog-grid"' not in s:
    if s.count(target) != 1: raise SystemExit('Grade esperada não encontrada; arquivo preservado.')
    s = s.replace(target, '''          <div id="reference-catalog-grid" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">''', 1)
p.write_text(s, encoding='utf-8')
print('R3D.1 integrado na aba Referências. Nenhuma regra Firebase alterada.')
