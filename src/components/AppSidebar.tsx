import { useApp } from '@/contexts/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  Bike,
  Building2,
  ChevronRight,
  Clock,
  Eye,
  FolderOpen,
  Image as ImageIcon,
  KanbanSquare,
  Layers,
  LogOut,
  MessageSquare,
  Monitor,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  ShoppingCart,
  Trophy,
  UserCircle,
  Users,
  Wallet,
  ClipboardList,
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

interface AppSidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobile?: boolean;
}

type NavItem = {
  icon: typeof KanbanSquare;
  label: string;
  path: string;
};

const primaryPaths = new Set([
  '/admin',
  '/board',
  '/admin/monitor',
  '/chat',
  '/corporate',
  '/departmental',
]);

const AppSidebar = ({
  onNavigate,
  collapsed = false,
  onCollapsedChange,
  mobile = false,
}: AppSidebarProps) => {
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

  const employees = users.filter((user) => user.role === 'employee' && user.active !== false);
  const admins = users.filter(
    (user) => user.role === 'admin' && user.active !== false && user.id !== currentUser.id
  );

  const baseItems: NavItem[] = isAdmin
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

  const defaultFinancial = isAdmin || isFinanceiro;
  const defaultCorridas = isAdmin || isMotoboy || isFinanceiro || isPatricia;
  const defaultTracking = true;

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
    baseItems.push({
      icon: PackageSearch,
      label: 'Encomendas Balcão',
      path: '/encomendas-balcao',
    });
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
    baseItems.push({
      icon: ImageIcon,
      label: 'Backfill Imagens',
      path: '/admin/backfill-images',
    });
  }

  const primaryItems = baseItems.filter((item) => primaryPaths.has(item.path));
  const operationItems = baseItems.filter((item) => !primaryPaths.has(item.path));

  const isActive = (path: string) => location.pathname === path;

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const initials = currentUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  const renderNavItem = (item: NavItem) => (
    <button
      key={item.path}
      type="button"
      title={collapsed ? item.label : undefined}
      onClick={() => handleNav(item.path)}
      className={cn(
        'jf-interactive relative flex h-11 w-full items-center rounded-xl text-sm font-medium',
        collapsed ? 'justify-center px-0' : 'gap-3 px-3',
        isActive(item.path)
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_22px_hsl(var(--brand-red)/0.18)]'
          : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
      aria-current={isActive(item.path) ? 'page' : undefined}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />

      {!collapsed && <span className="truncate">{item.label}</span>}

      {item.path === '/chat' && totalUnread > 0 && !isActive('/chat') && (
        <span
          className={cn(
            'flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground',
            collapsed ? 'absolute right-1.5 top-1.5 h-[16px] min-w-[16px]' : 'ml-auto h-[18px]'
          )}
        >
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      )}
    </button>
  );

  const renderPerson = (person: (typeof users)[number], clickable: boolean, subtitle?: string) => {
    const status = getStatus(person.id);

    const content = (
      <>
        <div className="relative shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-primary/15 text-[10px] font-semibold text-sidebar-foreground">
            {person.name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')}
          </div>

          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-background',
              status === 'online'
                ? 'bg-success'
                : status === 'paused'
                  ? 'bg-warning'
                  : 'bg-muted-foreground/45'
            )}
          />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <span className="block truncate text-xs text-sidebar-foreground">{person.name}</span>
          <span className="block truncate text-[10px] text-sidebar-foreground/45">
            {subtitle ||
              (person.role === 'admin'
                ? 'Administrador'
                : person.function ||
                  (person.sectors.length > 0
                    ? person.sectors.map((sector) => SECTOR_LABELS[sector]).join(', ')
                    : 'Funcionário'))}
          </span>
        </div>

        {clickable && <ChevronRight className="h-3 w-3 shrink-0 opacity-35" />}
      </>
    );

    if (!clickable) {
      return (
        <div key={person.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
          {content}
        </div>
      );
    }

    return (
      <button
        key={person.id}
        type="button"
        onClick={() => handleNav(`/admin/employee/${person.id}`)}
        className={cn(
          'jf-interactive flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-sidebar-accent',
          location.pathname === `/admin/employee/${person.id}` && 'bg-sidebar-accent'
        )}
      >
        {content}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        'sidebar-gradient flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-sidebar-border text-sidebar-foreground transition-[width] duration-220 ease-premium',
        mobile ? 'w-[280px]' : collapsed ? 'w-[76px]' : 'w-[248px]'
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border/80',
          collapsed ? 'justify-center px-2' : 'gap-2 px-3'
        )}
      >
        {collapsed ? (
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xs font-black tracking-tight text-primary-foreground shadow-[0_8px_24px_hsl(var(--brand-red)/0.18)]"
            onClick={() => onCollapsedChange?.(false)}
            title="Expandir menu"
          >
            JF
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center">
            <img src={logoImg} alt="JapanFlow" className="h-10 max-w-[162px] object-contain" />
          </div>
        )}

        {!mobile && !collapsed && (
          <button
            type="button"
            onClick={() => onCollapsedChange?.(true)}
            className="jf-interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Recolher menu"
            title="Recolher menu"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        )}

        {!mobile && collapsed && (
          <button
            type="button"
            onClick={() => onCollapsedChange?.(false)}
            className="sr-only"
            aria-label="Expandir menu"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/35">
            Principal
          </p>
        )}

        <div className="space-y-1">{primaryItems.map(renderNavItem)}</div>

        {operationItems.length > 0 && (
          <>
            {!collapsed && (
              <p className="mb-2 mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/35">
                Operação
              </p>
            )}

            {collapsed && <div className="my-3 h-px bg-sidebar-border" />}

            <div className="space-y-1">{operationItems.map(renderNavItem)}</div>
          </>
        )}

        {!collapsed && (
          <>
            <div className="my-4 h-px bg-sidebar-border/80" />

            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/35">
              Ferramentas
            </p>

            <div className="space-y-1">
              <PersonalNotesDialog userId={currentUser.id} />

              {(isAdmin ||
                currentUser.sectors?.includes('vendas' as Sector) ||
                currentUser.id === 'emp-1' ||
                currentUser.id === 'emp-11' ||
                hasFeature(currentUser.id, 'sales_calculator')) && <SalesCalculatorDialog />}
            </div>

            <div className="my-4 h-px bg-sidebar-border/80" />

            <details className="group">
              <summary className="jf-interactive flex h-10 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>Equipe</span>
                <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform duration-220 group-open:rotate-90" />
              </summary>

              <div className="mt-2 space-y-1 pl-1">
                {isAdmin ? (
                  <>
                    {admins.length > 0 && (
                      <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
                        Administradores
                      </p>
                    )}

                    {admins.map((admin) => renderPerson(admin, true, 'Administrador'))}

                    {employees.length > 0 && (
                      <p className="px-3 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
                        Equipe
                      </p>
                    )}

                    {employees.map((employee) => renderPerson(employee, true))}
                  </>
                ) : (
                  users
                    .filter((user) => user.active !== false && user.id !== currentUser.id)
                    .map((user) => renderPerson(user, false))
                )}
              </div>
            </details>
          </>
        )}

        {collapsed && (
          <>
            <div className="my-3 h-px bg-sidebar-border" />
            <button
              type="button"
              onClick={() => onCollapsedChange?.(false)}
              className="jf-interactive flex h-11 w-full items-center justify-center rounded-xl text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Ferramentas e equipe"
              aria-label="Abrir ferramentas e equipe"
            >
              <Users className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/80 p-2">
        <div
          className={cn(
            'flex items-center rounded-xl',
            collapsed ? 'flex-col gap-2 py-2' : 'gap-2.5 px-2 py-2'
          )}
        >
          <button
            type="button"
            onClick={() => handleNav('/profile')}
            title={collapsed ? currentUser.name : undefined}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={() => handleNav('/profile')}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {currentUser.name}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/45">
                {currentUser.role === 'admin'
                  ? 'Administrador'
                  : currentUser.function || 'Funcionário'}
              </p>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void logout().finally(() => navigate('/login'));
            }}
            className="jf-interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
