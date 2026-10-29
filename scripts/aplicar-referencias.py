from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def patch(rel, old, new):
 p=ROOT/rel
 if not p.exists(): raise SystemExit(f'Arquivo ausente: {rel}')
 s=p.read_text(encoding='utf-8')
 if new in s: print(f'OK (já aplicado): {rel}');return
 if old not in s: raise SystemExit(f'Padrão incompatível: {rel}. Nenhum trecho alterado.')
 p.write_text(s.replace(old,new,1),encoding='utf-8');print(f'OK: {rel}')
patch('src/App.tsx', "const ChatPage = lazy(() => import('@/pages/ChatPage'));", "const ChatPage = lazy(() => import('@/pages/ChatPage'));\nconst ReferencesPage = lazy(() => import('@/pages/ReferencesPage'));")
patch('src/App.tsx', '<Route path="/chat" element={<ChatPage />} />', '<Route path="/chat" element={<ChatPage />} />\n                <Route path="/referencias" element={<ReferencesPage />} />')
patch('src/components/AppLayout.tsx', "  '/chat': 'Chat',", "  '/chat': 'Chat',\n  '/referencias': 'Referências',")
patch('src/components/AppSidebar.tsx', "  Wrench,\n} from 'lucide-react';", "  Wrench,\n  Cog,\n} from 'lucide-react';")
patch('src/components/AppSidebar.tsx', "  '/chat',\n  '/corporate',", "  '/chat',\n  '/referencias',\n  '/corporate',")
patch('src/components/AppSidebar.tsx', "  const baseItems: NavItem[] = isAdmin", "  const canUseReferences = currentUser.active !== false && currentUser.sectors?.includes('vendas' as Sector);\n  const baseItems: NavItem[] = isAdmin")
patch('src/components/AppSidebar.tsx', "  const defaultFinancial = isAdmin || isFinanceiro;", "  if (canUseReferences) {\n    const afterChat = baseItems.findIndex(item => item.path === '/chat');\n    baseItems.splice(afterChat + 1, 0, { icon: 'departamental', label: 'Referências', path: '/referencias' });\n  }\n  const defaultFinancial = isAdmin || isFinanceiro;")
patch('src/components/AppSidebar.tsx', '      <JapanFlowIcon name={item.icon} className="h-[22px] w-[22px]" />', "      {item.path === '/referencias' ? <Cog className=\"h-[22px] w-[22px]\" /> : <JapanFlowIcon name={item.icon} className=\"h-[22px] w-[22px]\" />}")
# A coleção deve ser explicitamente removida do catch-all antes do deploy.
patch('firestore.rules', '    // Colecoes operacionais nao cobertas pelas regras especificas.', '''    function canUseSalesReferences() {
      return isActive() && exists(currentUserPath())
        && get(currentUserPath()).data.active != false
        && ('sectors' in get(currentUserPath()).data)
        && get(currentUserPath()).data.sectors.hasAny(['vendas']);
    }

    match /part_references/{referenceId} {
      allow get, list: if canUseSalesReferences();
      allow create: if canUseSalesReferences()
        && request.resource.data.keys().hasOnly(['name','description','vehicle_brand','vehicles','manufacturer','part_type','year_start','year_end','photos','created_by','created_at','updated_at'])
        && request.resource.data.keys().hasAll(['name','description','vehicle_brand','vehicles','manufacturer','part_type','year_start','year_end','photos','created_by','created_at','updated_at'])
        && request.resource.data.created_by == currentUserId()
        && request.resource.data.name is string && request.resource.data.name.size() >= 1 && request.resource.data.name.size() <= 140
        && request.resource.data.description is string && request.resource.data.description.size() <= 3000
        && request.resource.data.part_type is string && request.resource.data.part_type.size() >= 1 && request.resource.data.part_type.size() <= 100
        && request.resource.data.manufacturer is string && request.resource.data.manufacturer.size() >= 1 && request.resource.data.manufacturer.size() <= 120
        && request.resource.data.vehicle_brand in ['Mitsubishi','Toyota','Honda','Suzuki','Subaru']
        && request.resource.data.vehicles is list && request.resource.data.vehicles.size() >= 1 && request.resource.data.vehicles.size() <= 30
        && request.resource.data.year_start is int && request.resource.data.year_end is int
        && request.resource.data.year_start >= 1950 && request.resource.data.year_start <= request.resource.data.year_end && request.resource.data.year_end <= 2100
        && request.resource.data.photos is list && request.resource.data.photos.size() >= 1 && request.resource.data.photos.size() <= 6
        && request.resource.data.created_at == request.time && request.resource.data.updated_at == request.time;
      allow update, delete: if false;
    }

    // Colecoes operacionais nao cobertas pelas regras especificas.''')
patch('firestore.rules', "        && collection != 'tasks'", "        && collection != 'part_references'\n        && collection != 'tasks'")
patch('storage.rules', '    // ========================================\n    // BLOQUEIO PADRÃO', '''    // Fotos internas do catálogo: acesso exclusivo a funcionários de Vendas.
    function salesAccess() {
      return activeUser()
        && firestore.exists(/databases/(default)/documents/users/$(currentUserId()))
        && firestore.get(/databases/(default)/documents/users/$(currentUserId())).data.active != false
        && firestore.get(/databases/(default)/documents/users/$(currentUserId())).data.sectors.hasAny(['vendas']);
    }

    match /sales_references/{userId}/{fileName} {
      allow read: if salesAccess();
      allow create: if salesAccess() && currentUserId() == userId
        && resource == null && request.resource != null
        && request.resource.size > 0 && request.resource.size <= 8 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp)');
      allow update, delete: if false;
    }

    // ========================================
    // BLOQUEIO PADRÃO''')
print('Patch aplicado. Valide regras no emulador antes de publicar.')
