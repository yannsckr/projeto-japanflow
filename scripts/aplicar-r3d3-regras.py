from pathlib import Path
f=Path('firestore.rules'); s=f.read_text(encoding='utf-8'); marker='    match /part_references/{referenceId} {'
if marker not in s: raise SystemExit('firestore.rules divergente; nenhuma regra alterada.')
block='''    // R3D.3: modelos 3D compartilhados entre funcionários de Vendas.
    match /reference_3d_models/{modelId} {
      allow get, list: if canUseSalesReferences();
      allow create: if canUseSalesReferences()
        && request.resource.data.keys().hasOnly(['name','brand','path','map','created_by','created_at'])
        && request.resource.data.keys().hasAll(['name','brand','path','map','created_by','created_at'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 120
        && request.resource.data.brand in ['Mitsubishi','Toyota','Honda','Suzuki','Subaru']
        && request.resource.data.created_by == currentUserId()
        && request.resource.data.path is string
        && request.resource.data.path.matches('^reference_3d/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+[.]glb$')
        && request.resource.data.path.matches('^reference_3d/' + currentUserId() + '/.*')
        && request.resource.data.map is map
        && request.resource.data.map.keys().size() <= 1000
        && request.resource.data.created_at == request.time;
      allow update, delete: if false;
    }

'''
if 'match /reference_3d_models/' not in s:
 s=s.replace(marker, block+marker)
 # Exclude from catch-all
 s=s.replace("&& collection != 'part_references'", "&& collection != 'reference_3d_models'\n        && collection != 'part_references'")
 f.write_text(s,encoding='utf-8')
f=Path('storage.rules');s=f.read_text(encoding='utf-8'); marker='    match /sales_references/{userId}/{fileName} {'
if marker not in s: raise SystemExit('storage.rules divergente; revisar alterações antes de aplicar.')
block='''    // R3D.3: uploads de conjuntos GLB; leitura só para Vendas.
    match /reference_3d/{userId}/{fileName} {
      allow read: if salesAccess();
      allow create: if salesAccess() && currentUserId() == userId
        && resource == null && request.resource != null
        && fileName.matches('^[A-Za-z0-9_-]+[.]glb$')
        && request.resource.size > 0 && request.resource.size <= 30 * 1024 * 1024
        && request.resource.contentType == 'model/gltf-binary';
      allow update, delete: if false;
    }

'''
if 'match /reference_3d/{' not in s: s=s.replace(marker,block+marker);f.write_text(s,encoding='utf-8')
print('R3D.3: regras inseridas. Execute testes de segurança no emulador antes de publicar.')
