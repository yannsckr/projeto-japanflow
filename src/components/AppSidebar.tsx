import { useApp } from '@/contexts/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  KanbanSquare,
  MessageSquare,
  LogOut,
  ChevronRight,
  Building2,
  Layers,
  UserCircle,
  Wallet,
  Bike,
  StickyNote,
  Eye,
  Monitor,
  Trophy,
  ShoppingCart,
  PackageSearch,
  ClipboardList,
  Image as ImageIcon,
  FolderOpen,
  ScrollText,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImg from '@/assets/logo_japanflow.png';
import { SECTOR_LABELS, Sector } from '@/types';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import PersonalNotesDialog from '@/components/PersonalNotesDialog';
import SalesCalculatorDialog from '@/components/SalesCalculatorDialog';
import { useAllPresences } from '@/hooks/usePresence';
import { useTabPermissions } from '@/hooks/useTabPermissions';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';
import { Clock } from 'lucide-react';

interface AppSidebarProps {
  onNavigate?: () => void;
}

const AppSidebar = ({ onNavigate }: AppSidebarProps) => {
  const { currentUser, logout, users } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnread } = useUnreadMessages(currentUser?.id || null);
  const { getStatus } = useAllPresences();
  const { isTabEnabled } = useTabPermissions();
  const { hasFeature } = useFeaturePermissions();

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const isFinanceiro = currentUser.sectors?.includes('financeiro' as Sector);
  const isMotoboy = currentUser.sectors?.includes('motoboys' as Sector);
  const isPatricia = currentUser.id === 'emp-1';
  const employees = users.filter((u) => u.role === 'employee' && u.active !== false);
  const admins = users.filter(
    (u) => u.role === 'admin' && u.active !== false && u.id !== currentUser.id
  );

  const baseItems = isAdmin
    ? [
        { icon: KanbanSquare, label: 'Meu Quadro', path: '/admin' },
        { icon: Monitor, label: 'Monitoria', path: '/admin/monitor' },
        { icon: MessageSquare, label: 'Chat', path: '/chat' },
        { icon: Building2, label: 'Corporativo', path: '/corporate' },
        { icon: Layers, label: 'Departamental', path: '/departmental' },
      ]
    : [
        { icon: KanbanSquare, label: 'Meu Quadro', path: '/board' },
        { icon: MessageSquare, label: 'Chat', path: '/chat' },
        { icon: Building2, label: 'Corporativo', path: '/corporate' },
        { icon: Layers, label: 'Departamental', path: '/departmental' },
      ];

  // Default-allow rules for the optional tabs (overridable by admin via tab permissions)
  const defaultFinancial = isAdmin || isFinanceiro;
  const defaultCorridas = isAdmin || isMotoboy || isFinanceiro || isPatricia;
  const defaultTracking = true;

  // Admins always see all tabs; others respect the permission overrides.
  const canSeeFinancial = isAdmin || isTabEnabled(currentUser.id, 'financial', defaultFinancial);
  const canSeeCorridas = isAdmin || isTabEnabled(currentUser.id, 'corridas', defaultCorridas);
  const canSeeTracking = isAdmin || isTabEnabled(currentUser.id, 'tracking', defaultTracking);

  if (canSeeFinancial) {
    baseItems.push({ icon: Wallet, label: 'Financeiro', path: '/financial' });
  }
  if (canSeeCorridas) {
    baseItems.push({ icon: Bike, label: 'Corridas', path: '/corridas' });
  }
  if (canSeeTracking) {
    baseItems.push({ icon: Eye, label: 'Acompanhamento', path: '/tracking' });
  }
  const AWARDS_USERS = ['emp-6', 'emp-7', 'emp-4', 'emp-8', 'emp-10', 'emp-3', 'emp-11'];
  if (isAdmin || AWARDS_USERS.includes(currentUser.id)) {
    baseItems.push({ icon: Trophy, label: 'Premiações', path: '/awards' });
  }
  const isAdminSector = isAdmin || currentUser.sectors?.includes('administracao' as Sector);
  if (isAdminSector) {
    baseItems.push({ icon: ShoppingCart, label: 'Pedido de Compras', path: '/pedido-compras' });
  }
  const isCompras = currentUser.sectors?.includes('compras' as Sector);
  const isEstoque = currentUser.sectors?.includes('estoque' as Sector);
  const isVendas = currentUser.sectors?.includes('vendas' as Sector);
  if (isAdmin || isCompras || isEstoque || isVendas) {
    baseItems.push({ icon: PackageSearch, label: 'Encomendas Balcão', path: '/encomendas-balcao' });
  }
  if (isAdmin || isEstoque || currentUser.id === 'emp-10') {
    baseItems.push({ icon: ClipboardList, label: 'Inventário', path: '/inventario' });
  }
  baseItems.push({ icon: FolderOpen, label: 'Documentos', path: '/documentos' });
  baseItems.push({ icon: ScrollText, label: 'Políticas Internas', path: '/politicas-internas' });
  if (isAdminSector) {
    baseItems.push({
      icon: Archive,
      label: 'Histórico de Conversas',
      path: '/historico-conversas',
    });
  }
  baseItems.push({ icon: UserCircle, label: 'Perfil', path: '/profile' });
  if (isAdmin) {
    baseItems.push({ icon: Clock, label: 'Relatórios', path: '/time-reports' });
    baseItems.push({ icon: ImageIcon, label: 'Backfill Imagens', path: '/admin/backfill-images' });
  }

  const navItems = baseItems;

  const isActive = (path: string) => location.pathname === path;

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <aside className="w-64 md:w-64 h-screen min-h-0 sidebar-gradient flex flex-col overflow-hidden shrink-0">
      <div className="p-3 border-b border-sidebar-border flex justify-center bg-black">
        <img src={logoImg} alt="JapanFlow" className="w-full object-contain" />
      </div>

      <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto overscroll-contain">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNav(item.path)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative',
              isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
            {item.path === '/chat' && totalUnread > 0 && !isActive('/chat') && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 animate-pulse">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        ))}

        <PersonalNotesDialog userId={currentUser.id} />

        {(isAdmin ||
          currentUser.sectors?.includes('vendas' as Sector) ||
          currentUser.id === 'emp-1' ||
          currentUser.id === 'emp-11' ||
          hasFeature(currentUser.id, 'sales_calculator')) && <SalesCalculatorDialog />}

        {isAdmin ? (
          <div className="pt-4">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2">
              Administradores
            </p>
            {admins.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleNav(`/admin/employee/${emp.id}`)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                  location.pathname === `/admin/employee/${emp.id}`
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-[10px] font-semibold text-sidebar-primary-foreground">
                    {emp.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar-background',
                      getStatus(emp.id) === 'online'
                        ? 'bg-green-500'
                        : getStatus(emp.id) === 'paused'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <span className="truncate block text-xs">{emp.name}</span>
                  <span className="text-[9px] text-sidebar-foreground/40">Admin</span>
                </div>
                <ChevronRight className="w-3 h-3 ml-auto opacity-40 shrink-0" />
              </button>
            ))}

            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2 mt-3">
              Equipe
            </p>
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleNav(`/admin/employee/${emp.id}`)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                  location.pathname === `/admin/employee/${emp.id}`
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-[10px] font-semibold text-sidebar-primary-foreground">
                    {emp.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar-background',
                      getStatus(emp.id) === 'online'
                        ? 'bg-green-500'
                        : getStatus(emp.id) === 'paused'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <span className="truncate block text-xs">{emp.name}</span>
                  {emp.sectors.length > 0 && (
                    <span className="text-[9px] text-sidebar-foreground/40 truncate block">
                      {emp.sectors.map((s) => SECTOR_LABELS[s]).join(', ')}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-3 h-3 ml-auto opacity-40 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="pt-4">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2">
              Equipe
            </p>
            {users
              .filter((u) => u.active !== false && u.id !== currentUser.id)
              .map((u) => (
                <div
                  key={u.id}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70"
                >
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-[10px] font-semibold text-sidebar-primary-foreground">
                      {u.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar-background',
                        getStatus(u.id) === 'online'
                          ? 'bg-green-500'
                          : getStatus(u.id) === 'paused'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="truncate block text-xs">{u.name}</span>
                    <span className="text-[9px] text-sidebar-foreground/40">
                      {u.role === 'admin'
                        ? 'Admin'
                        : u.function ||
                          (u.sectors.length > 0
                            ? u.sectors.map((s) => SECTOR_LABELS[s]).join(', ')
                            : 'Funcionário')}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground overflow-hidden">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {currentUser.name}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50">
              {currentUser.role === 'admin'
                ? 'Administrador'
                : currentUser.function || 'Funcionário'}
            </p>
          </div>
          <button
            onClick={() => {
              void logout().finally(() => navigate('/login'));
            }}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
