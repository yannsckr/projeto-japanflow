from pathlib import Path
f=Path('firestore.rules');s=f.read_text(encoding='utf-8')
start=s.find('    match /reference_3d_models/{modelId} {')
end=s.find('    match /part_references/{referenceId} {',start)
if start<0 or end<0: raise SystemExit('R3D.3 não encontrado nas regras. Nenhuma alteração realizada.')
old=s[start:end]
if 'R3D.4-7 update' in old: print('Regras Firestore já atualizadas');
else:
    needle='      allow update, delete: if false;'
    if needle not in old: raise SystemExit('Bloco R3D.3 divergente. Revisar manualmente.')
    new='''      // R3D.4-7 update: somente autor ativo de Vendas; identidade, modelo, marca e caminho imutáveis.
      allow update: if canUseSalesReferences()
        && resource.data.created_by == currentUserId()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name','map','updated_at'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 120
        && request.resource.data.map is map
        && request.resource.data.map.keys().size() <= 1000
        && request.resource.data.updated_at == request.time;
      allow delete: if canUseSalesReferences()
        && resource.data.created_by == currentUserId();'''
    s=s[:start]+old.replace(needle,new)+s[end:]
    # Creation must allow model_file_name from new uploader; older docs without it remain valid.
    s=s.replace("['name','brand','path','map','created_by','created_at']", "['name','brand','path','map','created_by','created_at','model_file_name']")
    target='        && request.resource.data.brand in '
    k=s.find(target,s.find('match /reference_3d_models/'))
    if k>0:s=s[:k]+"        && request.resource.data.get('model_file_name', '') is string\n        && request.resource.data.get('model_file_name', '').size() <= 160\n"+s[k:]
    f.write_text(s,encoding='utf-8');print('Firestore atualizado; revisar diff e testar no emulador.')
f=Path('storage.rules');s=f.read_text(encoding='utf-8')
start=s.find('    match /reference_3d/{userId}/{fileName} {');end=s.find('    match /sales_references/',start)
if start<0 or end<0:raise SystemExit('R3D.3 não encontrado no Storage. Nenhuma regra Storage alterada.')
block=s[start:end]
if 'allow update, delete: if false;' not in block:print('Storage já modificado. Revisar manualmente.')
else:
 block=block.replace('allow update, delete: if false;',"allow update: if false;\n      allow delete: if salesAccess() && currentUserId() == userId;")
 s=s[:start]+block+s[end:];f.write_text(s,encoding='utf-8');print('Storage atualizado; testar deleção do autor e negação para outros.')
