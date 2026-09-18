import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Users,
  Wrench,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import JapanFlowIcon, { JapanFlowIconName } from '@/components/JapanFlowIcon';
import logoDark from '@/assets/japanflow-logo-dark.png';
import logoLight from '@/assets/japanflow-logo-light.png';
import markLight from '@/assets/japanflow-mark-light.png';
import markDark from '@/assets/japanflow-mark-dark.png';
import { useThemeToggle } from '@/hooks/useThemeToggle';
import { SECTOR_LABELS, Sector } from '@/types';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import PersonalNotesDialog from '@/components/PersonalNotesDialog';
import SalesCalculatorDialog from '@/components/SalesCalculatorDialog';
import { useAllPresences } from '@/hooks/usePresence';
import { useTabPermissions } from '@/hooks/useTabPermissions';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';
import { resetLoginSplash } from '@/lib/loginSplash';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppSidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobile?: boolean;
}

type NavItem = {
  icon: JapanFlowIconName;
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
  const { theme } = useThemeToggle();
  const sidebarLogo = theme === 'light' ? logoLight : logoDark;
  const sidebarMark = theme === 'light' ? markLight : markDark;

  const [primaryOpen, setPrimaryOpen] = useState(true);
  const [operationOpen, setOperationOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(false);
  const [manualStatus, setManualStatus] = useState<'available' | 'busy' | 'unavailable'>(
    'available'
  );

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'user_presence', currentUser.id),
      (snapshot) => {
        const value = snapshot.data()?.manual_status;
        if (value === 'available' || value === 'busy' || value === 'unavailable') {
          setManualStatus(value);
        }
      },
      () => undefined
    );

    return unsubscribe;
  }, [currentUser?.id]);

  const updateManualStatus = async (next: 'available' | 'busy' | 'unavailable') => {
    setManualStatus(next);

    try {
      await setDoc(
        doc(db, 'user_presence', currentUser.id),
        {
          user_id: currentUser.id,
          manual_status: next,
          status: next === 'available' ? 'online' : next === 'busy' ? 'busy' : 'offline',
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('Não foi possível atualizar o status manual:', error);
    }
  };

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const dashboardPath = isAdmin ? '/admin' : '/board';
  const isFinanceiro = currentUser.sectors?.includes('financeiro' as Sector);
  const isMotoboy = currentUser.sectors?.includes('motoboys' as Sector);
  const isPatricia = currentUser.id === 'emp-1';

  const employees = users.filter((user) => user.role === 'employee' && user.active !== false);
  const admins = users.filter(
    (user) => user.role === 'admin' && user.active !== false && user.id !== currentUser.id
  );

  const baseItems: NavItem[] = isAdmin
    ? [
        { icon: 'meu-quadro', label: 'Meu Quadro', path: '/admin' },
        { icon: 'monitoria', label: 'Monitoria', path: '/admin/monitor' },
        { icon: 'chat', label: 'Chat', path: '/chat' },
        { icon: 'corporativo', label: 'Corporativo', path: '/corporate' },
        { icon: 'departamental', label: 'Departamental', path: '/departmental' },
      ]
    : [
        { icon: 'meu-quadro', label: 'Meu Quadro', path: '/board' },
        { icon: 'chat', label: 'Chat', path: '/chat' },
        { icon: 'corporativo', label: 'Corporativo', path: '/corporate' },
        { icon: 'departamental', label: 'Departamental', path: '/departmental' },
      ];

  const defaultFinancial = isAdmin || isFinanceiro;
  const defaultCorridas = isAdmin || isMotoboy || isFinanceiro || isPatricia;
  const defaultTracking = true;

  const canSeeFinancial = isAdmin || isTabEnabled(currentUser.id, 'financial', defaultFinancial);
  const canSeeCorridas = isAdmin || isTabEnabled(currentUser.id, 'corridas', defaultCorridas);
  const canSeeTracking = isAdmin || isTabEnabled(currentUser.id, 'tracking', defaultTracking);

  if (canSeeFinancial) {
    baseItems.push({ icon: 'financeiro', label: 'Financeiro', path: '/financial' });
  }

  if (canSeeCorridas) {
    baseItems.push({ icon: 'corridas', label: 'Corridas', path: '/corridas' });
  }

  if (canSeeTracking) {
    baseItems.push({ icon: 'acompanhamento', label: 'Acompanhamento', path: '/tracking' });
  }

  const AWARDS_USERS = ['emp-6', 'emp-7', 'emp-4', 'emp-8', 'emp-10', 'emp-3', 'emp-11'];

  if (isAdmin || AWARDS_USERS.includes(currentUser.id)) {
    baseItems.push({ icon: 'premiacoes', label: 'Premiações', path: '/awards' });
  }

  const isAdminSector = isAdmin || currentUser.sectors?.includes('administracao' as Sector);

  if (isAdminSector) {
    baseItems.push({
      icon: 'pedido-de-compras',
      label: 'Pedido de Compras',
      path: '/pedido-compras',
    });
  }

  const isCompras = currentUser.sectors?.includes('compras' as Sector);
  const isEstoque = currentUser.sectors?.includes('estoque' as Sector);
  const isVendas = currentUser.sectors?.includes('vendas' as Sector);

  if (isAdmin || isCompras || isEstoque || isVendas) {
    baseItems.push({
      icon: 'encomendas-balcao',
      label: 'Encomendas Balcão',
      path: '/encomendas-balcao',
    });
  }

  if (isAdmin || isEstoque || currentUser.id === 'emp-10') {
    baseItems.push({ icon: 'inventario', label: 'Inventário', path: '/inventario' });
  }

  baseItems.push({ icon: 'documentos', label: 'Documentos', path: '/documentos' });
  baseItems.push({
    icon: 'politicas-internas',
    label: 'Políticas Internas',
    path: '/politicas-internas',
  });

  if (isAdminSector) {
    baseItems.push({
      icon: 'historico-de-conversas',
      label: 'Histórico de Conversas',
      path: '/historico-conversas',
    });
  }

  baseItems.push({ icon: 'perfil', label: 'Perfil', path: '/profile' });

  if (isAdmin) {
    baseItems.push({ icon: 'relatorios', label: 'Relatórios', path: '/time-reports' });
    baseItems.push({
      icon: 'backfill-imagens',
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
        'jf-interactive relative flex min-h-10 w-full items-center rounded-xl text-sm font-medium',
        collapsed ? 'justify-center px-0' : 'gap-3 px-3',
        isActive(item.path)
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_22px_hsl(var(--brand-red)/0.18)]'
          : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
      aria-current={isActive(item.path) ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <JapanFlowIcon name={item.icon} className="h-[22px] w-[22px]" />

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
        'sidebar-gradient flex h-[100dvh] min-h-[100dvh] max-h-[100dvh] shrink-0 flex-col overflow-hidden border-r border-sidebar-border text-sidebar-foreground transition-[width] duration-220 ease-premium',
        mobile ? 'w-[min(90vw,328px)]' : collapsed ? 'w-[72px]' : 'w-[248px]'
      )}
    >
      <div
        className={cn(
          'relative shrink-0 border-b border-sidebar-border/80',
          collapsed
            ? 'flex h-24 flex-col items-center justify-center gap-2 px-2'
            : 'flex h-[72px] items-center px-3'
        )}
      >
        {collapsed ? (
          <>
            <button
              type="button"
              className="jf-interactive flex h-11 w-11 items-center justify-center rounded-xl hover:bg-sidebar-accent"
              onClick={() => handleNav(dashboardPath)}
              title="Ir para Meu Quadro"
              aria-label="Ir para Meu Quadro"
            >
              <img
                src={sidebarMark}
                alt=""
                aria-hidden="true"
                className="h-10 w-10 object-contain"
              />
            </button>

            {!mobile && (
              <button
                type="button"
                onClick={() => onCollapsedChange?.(false)}
                className="jf-interactive flex h-8 w-8 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-background text-sidebar-foreground/55 shadow-sm hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Expandir menu"
                title="Expandir menu"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleNav(dashboardPath)}
              className="jf-interactive flex items-center justify-start rounded-xl px-1 py-1"
              aria-label="Ir para Meu Quadro"
              title="Ir para Meu Quadro"
            >
              <img
                src={sidebarLogo}
                alt="JapanFlow"
                className="h-9 w-auto max-w-[148px] object-contain transition-opacity duration-300"
              />
            </button>

            {!mobile && (
              <button
                type="button"
                onClick={() => onCollapsedChange?.(true)}
                className="jf-interactive absolute right-3 flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Recolher menu"
                title="Recolher menu"
              >
                <PanelLeftClose className="h-[18px] w-[18px]" />
              </button>
            )}
          </>
        )}
      </div>

      <nav
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 pt-3 [scrollbar-gutter:stable]',
          collapsed ? 'px-2' : 'px-3'
        )}
        aria-label="Navegação principal"
      >
        {!collapsed && (
          <button
            type="button"
            onClick={() => setPrimaryOpen((value) => !value)}
            className="jf-interactive mb-1 flex h-9 w-full items-center rounded-xl px-3 text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-expanded={primaryOpen}
          >
            <LayoutGrid className="mr-2 h-4 w-4 shrink-0" />
            <span>Principal</span>
            <ChevronRight
              className={cn('ml-auto h-3.5 w-3.5 transition-transform', primaryOpen && 'rotate-90')}
            />
          </button>
        )}

        {(collapsed || primaryOpen) && (
          <div className="space-y-0.5">{primaryItems.map(renderNavItem)}</div>
        )}

        {operationItems.length > 0 && (
          <>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setOperationOpen((value) => !value)}
                className="jf-interactive mb-1 mt-3 flex h-9 w-full items-center rounded-xl px-3 text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-expanded={operationOpen}
              >
                <Settings2 className="mr-2 h-4 w-4 shrink-0" />
                <span>Operação</span>
                <ChevronRight
                  className={cn(
                    'ml-auto h-3.5 w-3.5 transition-transform',
                    operationOpen && 'rotate-90'
                  )}
                />
              </button>
            )}

            {collapsed && <div className="my-2 h-px bg-sidebar-border" />}

            {(collapsed || operationOpen) && (
              <div className="space-y-0.5">{operationItems.map(renderNavItem)}</div>
            )}
          </>
        )}

        {!collapsed && (
          <>
            <div className="my-3 h-px bg-sidebar-border/80" />

            <button
              type="button"
              onClick={() => setToolsOpen((value) => !value)}
              className="jf-interactive mb-1 flex h-9 w-full items-center rounded-xl px-3 text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-expanded={toolsOpen}
            >
              <Wrench className="mr-2 h-4 w-4 shrink-0" />
              <span>Ferramentas</span>
              <ChevronRight
                className={cn('ml-auto h-3.5 w-3.5 transition-transform', toolsOpen && 'rotate-90')}
              />
            </button>

            {toolsOpen && (
              <div className="space-y-0.5">
                <PersonalNotesDialog
                  userId={currentUser.id}
                  trigger={
                    <button className="jf-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                      <JapanFlowIcon name="anotacoes" className="h-[22px] w-[22px]" />
                      <span>Anotações</span>
                    </button>
                  }
                />

                {(isAdmin ||
                  currentUser.sectors?.includes('vendas' as Sector) ||
                  currentUser.id === 'emp-1' ||
                  currentUser.id === 'emp-11' ||
                  hasFeature(currentUser.id, 'sales_calculator')) && (
                  <SalesCalculatorDialog
                    trigger={
                      <button className="jf-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                        <JapanFlowIcon name="calculadora-de-vendas" className="h-[22px] w-[22px]" />
                        <span>Calculadora de Vendas</span>
                      </button>
                    }
                  />
                )}
              </div>
            )}

            <div className="my-3 h-px bg-sidebar-border/80" />

            <button
              type="button"
              onClick={() => setTeamOpen((value) => !value)}
              className="jf-interactive flex h-9 w-full items-center gap-3 rounded-xl px-3 text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-expanded={teamOpen}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Equipe</span>
              <ChevronRight
                className={cn('ml-auto h-3.5 w-3.5 transition-transform', teamOpen && 'rotate-90')}
              />
            </button>

            {teamOpen && (
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
            )}
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
              <Users className="h-[22px] w-[22px]" />
            </button>
          </>
        )}
      </nav>

      <div className="sticky bottom-0 z-10 shrink-0 border-t border-sidebar-border/80 bg-sidebar-background/95 p-2 backdrop-blur-md">
        <div
          className={cn(
            'flex items-center rounded-xl',
            collapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <button
            type="button"
            onClick={() => handleNav('/profile')}
            title={collapsed ? currentUser.name : undefined}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-visible rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
            aria-label={`Abrir perfil de ${currentUser.name}`}
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={`Foto de perfil de ${currentUser.name}`}
                className="h-full w-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  className={cn(
                    'absolute -bottom-1 -right-1 h-4 w-4 cursor-pointer rounded-full border-2 border-sidebar-background shadow-sm transition-transform duration-200 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary/40',
                    manualStatus === 'available'
                      ? 'bg-success'
                      : manualStatus === 'busy'
                        ? 'bg-warning'
                        : 'bg-muted-foreground/45'
                  )}
                  aria-label="Alterar status"
                  title="Alterar status"
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="start" className="w-44">
                <DropdownMenuItem onClick={() => void updateManualStatus('available')}>
                  <span className="mr-2 h-2.5 w-2.5 rounded-full bg-success" />
                  Disponível
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void updateManualStatus('busy')}>
                  <span className="mr-2 h-2.5 w-2.5 rounded-full bg-warning" />
                  Ocupado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void updateManualStatus('unavailable')}>
                  <span className="mr-2 h-2.5 w-2.5 rounded-full bg-muted-foreground/45" />
                  Indisponível
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </button>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => handleNav('/profile')}
                className="block min-w-0 max-w-full text-left"
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
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={() => {
                resetLoginSplash();
                void logout().finally(() => navigate('/login'));
              }}
              className="jf-interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
