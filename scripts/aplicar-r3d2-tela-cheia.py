from pathlib import Path
from shutil import copy2
import sys
root=Path.cwd()
paths=['src/components/references/Reference3DExplorer.tsx','src/components/references/ReferenceGLBMapper.tsx']
source=Path(__file__).resolve().parents[1]
for name in paths:
    target=root/name
    original=source/name
    if not target.is_file():
        sys.exit(f'Arquivo ausente: {name}. Instale o R3D.2 antes.')
    current=target.read_text(encoding='utf-8')
    if 'ReferenceGLBMapper' not in current and name.endswith('Reference3DExplorer.tsx'):
        sys.exit('R3D.2 não encontrado; abortando para não substituir sua versão.')
    if current == original.read_text(encoding='utf-8'):
        print('Já atualizado:',name)
        continue
    copy2(target,target.with_suffix('.tsx.before-r3d21.bak'))
    target.write_bytes(original.read_bytes())
    print('Atualizado:',name)
print('R3D.2.1 aplicado. Execute npm run typecheck, lint, test e build.')
