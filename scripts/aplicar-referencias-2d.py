#!/usr/bin/env python3
"""Atualiza regras sem sobrescrever regras de outros módulos. Idempotente."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
firestore = root / 'firestore.rules'
storage = root / 'storage.rules'
sidebar = root / 'src/components/AppSidebar.tsx'

f = firestore.read_text(encoding='utf-8')
anchor = '    match /part_references/{referenceId} {'
if anchor not in f:
    raise SystemExit('ERRO: regras do part_references não encontradas; nada alterado.')
marker = '    // REF-DIAGRAMS-V1 - administração exclusivamente por role admin'
if marker not in f:
    block = '''    // REF-DIAGRAMS-V1 - administração exclusivamente por role admin
    function canReadDiagrams() {
      return isActive() && exists(currentUserPath())
        && get(currentUserPath()).data.active != false
        && (ownLink().role == 'admin'
          || (('sectors' in get(currentUserPath()).data)
            && get(currentUserPath()).data.sectors.hasAny(['vendas'])));
    }

    function canEditDiagrams() {
      return isActive() && exists(currentUserPath())
        && get(currentUserPath()).data.active != false
        && ownLink().role == 'admin';
    }

    function validDiagram() {
      let d = request.resource.data;
      return d.keys().hasOnly(['brand','system','title','vehicle','year_range','image_path','markers','created_by','created_at','updated_at'])
        && d.keys().hasAll(['brand','system','title','vehicle','year_range','image_path','markers','created_by','created_at','updated_at'])
        && d.brand in ['Mitsubishi','Toyota','Honda','Suzuki','Subaru']
        && d.system in ['Suspensão','Câmbio','Motor','Direção','Freios','Transmissão','Arrefecimento','Elétrica','Carroceria','Outros']
        && d.title is string && d.title.size() > 0 && d.title.size() <= 180
        && d.vehicle is string && d.vehicle.size() > 0 && d.vehicle.size() <= 180
        && d.year_range is string && d.year_range.size() <= 80
        && d.image_path is string && d.image_path.size() <= 350
        && d.image_path.matches('^reference_diagrams/[A-Za-z0-9_-]{1,180}/[A-Za-z0-9_-]{1,180}[.](jpg|png|webp)$')
        && d.markers is list && d.markers.size() <= 60;
    }

    match /reference_diagrams/{diagramId} {
      allow get, list: if canReadDiagrams();
      allow create: if canEditDiagrams() && validDiagram()
        && request.resource.data.created_by == currentUserId()
        && request.resource.data.created_at == request.time
        && request.resource.data.updated_at == request.time
        && request.resource.data.markers.size() == 0;
      allow update: if canEditDiagrams() && validDiagram()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['markers','updated_at'])
        && request.resource.data.updated_at == request.time;
      allow delete: if false;
    }

'''
    f = f.replace(anchor, block + anchor, 1)
    # Important: recursive catch-all must not bypass the specific collection permissions.
    catch = "        && collection != 'part_references'"
    if catch not in f:
        raise SystemExit('ERRO: exclusão do catch-all não encontrada; nada gravado.')
    f = f.replace(catch, catch + "\n        && collection != 'reference_diagrams'", 1)
    firestore.write_text(f, encoding='utf-8')

s = storage.read_text(encoding='utf-8')
marker2 = '    // REF-DIAGRAMS-V1 - somente admin publica imagens técnicas'
if marker2 not in s:
    anchor2 = '    match /sales_references/{userId}/{fileName} {'
    if anchor2 not in s: raise SystemExit('ERRO: âncora do Storage não encontrada; revise regras manualmente.')
    block2 = '''    // REF-DIAGRAMS-V1 - somente admin publica imagens técnicas
    function canReadDiagramImages() {
      return activeUser()
        && firestore.exists(/databases/(default)/documents/users/$(currentUserId()))
        && firestore.get(/databases/(default)/documents/users/$(currentUserId())).data.active != false
        && (adminUser() || firestore.get(/databases/(default)/documents/users/$(currentUserId())).data.sectors.hasAny(['vendas']));
    }
    match /reference_diagrams/{userId}/{fileName} {
      allow read: if canReadDiagramImages();
      allow create: if canReadDiagramImages() && adminUser() && currentUserId() == userId
        && resource == null && request.resource != null
        && request.resource.size > 0 && request.resource.size <= 8 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp)')
        && fileName.matches('^[A-Za-z0-9_-]{1,180}[.](jpg|png|webp)$');
      allow update, delete: if false;
    }

'''
    s=s.replace(anchor2,block2+anchor2,1)
    storage.write_text(s,encoding='utf-8')
# Garantir acesso também aos administradores, mesmo sem setor de Vendas.
if sidebar.exists():
    nav = sidebar.read_text(encoding='utf-8')
    old = "currentUser.active !== false && currentUser.sectors?.includes('vendas' as Sector);"
    new = "currentUser.active !== false && (isAdmin || currentUser.sectors?.includes('vendas' as Sector));"
    if old in nav:
        sidebar.write_text(nav.replace(old, new, 1), encoding='utf-8')
    elif new not in nav:
        raise SystemExit('AVISO: sidebar diferente da versão esperada; ajuste manualmente a permissão de Referências para admins.')
print('Regras e navegação do catálogo 2D aplicadas (ou já estavam presentes).')
