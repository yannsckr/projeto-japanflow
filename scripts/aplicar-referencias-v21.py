from pathlib import Path
import shutil
root=Path.cwd()
src=Path(__file__).resolve().parents[1]
page=root/'src/pages/ReferencesPage.tsx'
if not page.exists():raise SystemExit('Página Referências não encontrada; confira a raiz do projeto.')
original=page.read_text(encoding='utf-8')
if "collection(db,'part_references')" not in original and "collection(db, 'part_references')" not in original:
    raise SystemExit('Página de Referências incompatível; nada alterado.')
fr=root/'firestore.rules';sr=root/'storage.rules'
fire=fr.read_text(encoding='utf-8');stor=sr.read_text(encoding='utf-8')
old='allow update, delete: if false;'
mark='match /part_references/{referenceId} {'
if mark not in fire:raise SystemExit('Coleção part_references não encontrada em firestore.rules; nada alterado.')
a,b=fire.split(mark,1)
if old in b.split('}',1)[0]: b=b.replace(old,'allow update: if false;\n      allow delete: if canUseSalesReferences();',1)
elif 'allow delete: if canUseSalesReferences();' not in b.split('}',1)[0]:raise SystemExit('Regras de catálogo inesperadas; nada alterado.')
fire2=a+mark+b
mark2='match /sales_references/{userId}/{fileName} {'
if mark2 not in stor:raise SystemExit('Storage sales_references não encontrado; nada alterado.')
a,b=stor.split(mark2,1)
if 'allow update, delete: if false;' in b.split('}',1)[0]:b=b.replace('allow update, delete: if false;', 'allow update: if false;\n      allow delete: if salesAccess();',1)
elif 'allow delete: if salesAccess();' not in b.split('}',1)[0]:raise SystemExit('Regras de fotos inesperadas; nada alterado.')
stor2=a+mark2+b
shutil.copy2(page,page.with_suffix('.tsx.v20.bak'))
page.write_text((src/'src/pages/ReferencesPage.tsx').read_text(encoding='utf-8'),encoding='utf-8')
fr.write_text(fire2,encoding='utf-8');sr.write_text(stor2,encoding='utf-8')
for logo in (src/'public/brands').glob('*.svg'):
    target=root/'public/brands'/logo.name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(logo,target)
print('Referências v2.1 instaladas; backup .tsx.v20.bak criado. Formate e teste antes do deploy.')
