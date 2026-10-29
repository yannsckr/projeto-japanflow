import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Menu } from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { usePresence } from '@/hooks/usePresence';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTabTitleNotifications } from '@/hooks/useTabTitleNotifications';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useIsMobile } from '@/hooks/use-mobile';

import AppSidebar from './AppSidebar';
import NotificationBell from './NotificationBell';
import PauseButton from './PauseButton';
import ReminderPopup from './ReminderPopup';
import BulletinAlertPopup from './BulletinAlertPopup';
import AdminPopupAlert from './AdminPopupAlert';
import NewTaskPopup from './NewTaskPopup';
import RyanAnnouncements from './RyanAnnouncements';
import ReportProblemButton from './ReportProblemButton';
import AutoVersionRefresh from './AutoVersionRefresh';
import InventoryHeaderBanner from './InventoryHeaderBanner';
import ForcePasswordChangeDialog from '@/components/ForcePasswordChangeDialog';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import LoginSplash from '@/components/LoginSplash';
import BacklogReplyPopup from '@/components/BacklogReplyPopup';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { getClientPublicIp, isIpAllowed } from '@/lib/networkGuard';
import { userCanAccessExternally } from '@/lib/externalAccess';

const SIDEBAR_STORAGE_KEY = 'japanflow-sidebar-collapsed';
const SIDEBAR_WIDTH_KEY = 'japanflow-sidebar-width';

const pageTitles: Record<string, string> = {
  '/admin': 'Meu Quadro',
  '/admin/monitor': 'Monitoria',
  '/gas': 'Gestão de Análise do Sistema',
  '/backlog': 'TI',
  '/board': 'Meu Quadro',
  '/chat': 'Chat',
  '/referencias': 'Referências',
  '/corporate': 'Corporativo',
  '/departmental': 'Departamental',
  '/departmental/motoboys/mapa': 'Mapa de motoboys',
  '/financial': 'Financeiro',
  '/corridas': 'Corridas',
  '/time-reports': 'Relatórios',
  '/tracking': 'Acompanhamento',
  '/awards': 'Premiações',
  '/pedido-compras': 'Pedido de Compras',
  '/encomendas-balcao': 'Encomendas Balcão',
  '/inventario': 'Inventário',
  '/profile': 'Perfil',
  '/admin/backfill-images': 'Backfill de Imagens',
  '/documentos': 'Documentos',
  '/politicas-internas': 'Políticas Internas',
  '/historico-conversas': 'Histórico de Conversas',
};

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/admin/employee/')) return 'Quadro da Equipe';
  return pageTitles[pathname] ?? 'JapanFlow';
}

const AppLayout = () => {
  const { currentUser, authenticatedUser, authLoading, logout, notifications } = useApp();

  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(raw) && raw >= 200 && raw <= 340 ? raw : 248;
  });
  const draggingRef = useRef(false);
  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    const move = (e: PointerEvent) => setSidebarWidth(Math.max(200, Math.min(340, e.clientX)));
    const stop = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }, []);
  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);
  // 1.2-A: SplashScreen temporariamente desabilitada (componente preservado).
  const splashRequested = false;
  const [showLoginSplash, setShowLoginSplash] = useState(splashRequested);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });

  const isChatRoute = location.pathname === '/chat';
  const canViewTi = ['ryan', 'japan-ti'].includes(
    authenticatedUser?.username?.trim().toLowerCase() || ''
  );
  const isTiRoute =
    canViewTi && (location.pathname === '/backlog' || location.pathname === '/sentinel');
  const [tiLight, setTiLight] = useState(() => localStorage.getItem('jf:ti-theme') === 'light');
  useEffect(() => {
    const sync = () => setTiLight(localStorage.getItem('jf:ti-theme') === 'light');
    window.addEventListener('jf:ti-theme-change', sync);
    return () => window.removeEventListener('jf:ti-theme-change', sync);
  }, []);
  const isBoardRoute =
    location.pathname === '/admin' ||
    location.pathname === '/board' ||
    location.pathname.startsWith('/admin/employee/');
  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  const { updatePresenceStatus } = usePresence(currentUser?.id || null);

  usePushNotifications();

  const { totalUnread: unreadMessages } = useUnreadMessages(authenticatedUser?.id || null);

  const unreadNotifs = currentUser
    ? notifications.filter(
        (notification) => notification.userId === currentUser.id && !notification.read
      ).length
    : 0;

  useTabTitleNotifications(unreadNotifs + unreadMessages);

  const handleSplashComplete = useCallback(() => {
    setShowLoginSplash(false);
    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (splashRequested) {
      setShowLoginSplash(true);
    }
  }, [splashRequested]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') return;

    let cancelled = false;

    void (async () => {
      const ip = await getClientPublicIp();

      if (cancelled) return;
      if (isIpAllowed(ip)) return;

      const allowed = await userCanAccessExternally(currentUser.id);

      if (cancelled) return;

      if (!allowed) {
        await logout();
        navigate('/login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, logout, navigate]);

  if (authLoading) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-background px-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-card">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Verificando sessão...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (showLoginSplash) {
    return (
      <LoginSplash
        userName={currentUser.name}
        onComplete={handleSplashComplete}
        minimumDuration={5000}
      />
    );
  }

  return (
    <>
      <ReminderPopup />
      <BulletinAlertPopup />
      <AdminPopupAlert />
      <NewTaskPopup />
      <BacklogReplyPopup />
      <AutoVersionRefresh />
      <ForcePasswordChangeDialog />

      <div
        className={`flex min-h-[100dvh] overflow-hidden ${isTiRoute ? (tiLight ? 'jf-ti-light bg-[#e7f0fd]' : 'jf-ti-dark bg-[#080f20]') : 'bg-background'}`}
      >
        {!isMobile && (
          <AppSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            width={sidebarWidth}
            onResizeStart={startResize}
          />
        )}

        <div
          className={`flex h-[100dvh] max-h-[100dvh] min-w-0 flex-1 flex-col ${isBoardRoute ? 'jf-workspace-shell' : ''}`}
        >
          <header
            className={`relative z-30 flex min-h-14 shrink-0 items-center gap-1.5 border-b px-2 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-3 md:px-5 ${isTiRoute ? (tiLight ? 'border-blue-200 bg-[#edf4ff] text-slate-900' : 'border-[#243554] bg-[#101c35] text-slate-100') : 'border-border/70 bg-background/85'}`}
          >
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {isMobile && (
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl"
                      aria-label="Abrir menu principal"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>

                  <SheetContent
                    side="left"
                    className="w-[min(88vw,320px)] border-r-0 bg-transparent p-0 shadow-none"
                    aria-label="Menu principal"
                  >
                    <AppSidebar mobile collapsed={false} onNavigate={() => setSidebarOpen(false)} />
                  </SheetContent>
                </Sheet>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-none md:text-base">
                  {pageTitle}
                </p>
                <p className="mt-1 hidden truncate text-[11px] opacity-60 sm:block">
                  JapanFlow · Japan Imports
                </p>
              </div>
            </div>

            <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1 sm:gap-2">
              <RyanAnnouncements />
              <ReportProblemButton />
              {isBoardRoute && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted sm:text-sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('jf:workspace:customize'))}
                  aria-label="Personalizar espaço"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Personalizar espaço</span>
                </button>
              )}
            </div>
            <div className="mx-auto hidden min-w-0 flex-1 justify-center px-4 lg:flex">
              <div className="max-w-xl overflow-hidden">
                <InventoryHeaderBanner />
              </div>
            </div>

            <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1 md:gap-1.5">
              <PauseButton updatePresence={updatePresenceStatus} />
              <ThemeSwitcher />
              {(isMobile || !sidebarCollapsed) && <NotificationBell />}
            </div>
          </header>

          <main
            id="main-content"
            className={
              isChatRoute
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2 md:p-3'
                : `min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-5 lg:p-6 ${isBoardRoute ? 'jf-workspace-main' : ''} ${isTiRoute ? (tiLight ? 'bg-[#e7f0fd]' : 'bg-[#080f20]') : ''}`
            }
          >
            <div
              className={
                isChatRoute
                  ? 'flex min-h-0 flex-1 flex-col'
                  : isBoardRoute
                    ? `mx-auto min-h-full w-full min-w-0 animate-fade-up transition-[max-width] duration-300 ${
                        !isMobile && sidebarCollapsed ? 'max-w-[1760px]' : 'max-w-[1480px]'
                      }`
                    : isTiRoute
                      ? 'min-h-full w-full min-w-0 animate-fade-up'
                      : 'mx-auto min-h-full w-full min-w-0 max-w-6xl animate-fade-up'
              }
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default AppLayout;
