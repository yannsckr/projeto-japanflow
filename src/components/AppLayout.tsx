import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';

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
import InventoryHeaderBanner from './InventoryHeaderBanner';
import ForcePasswordChangeDialog from '@/components/ForcePasswordChangeDialog';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import LoginSplash from '@/components/LoginSplash';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { getClientPublicIp, isIpAllowed } from '@/lib/networkGuard';
import { userCanAccessExternally } from '@/lib/externalAccess';
import {
  hasShownLoginSplash,
  markLoginSplashAsShown,
  resetLoginSplash,
} from '@/lib/loginSplash';

const SIDEBAR_STORAGE_KEY = 'japanflow-sidebar-collapsed';

const pageTitles: Record<string, string> = {
  '/admin': 'Meu Quadro',
  '/admin/monitor': 'Monitoria',
  '/board': 'Meu Quadro',
  '/chat': 'Chat',
  '/corporate': 'Corporativo',
  '/departmental': 'Departamental',
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
  const { currentUser, authLoading, logout, notifications } = useApp();

  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLoginSplash, setShowLoginSplash] = useState(() => !hasShownLoginSplash());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });

  const isChatRoute = location.pathname === '/chat';
  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  const { updatePresenceStatus } = usePresence(currentUser?.id || null);

  usePushNotifications();

  const { totalUnread: unreadMessages } = useUnreadMessages(currentUser?.id || null);

  const unreadNotifs = currentUser
    ? notifications.filter(
        (notification) => notification.userId === currentUser.id && !notification.read
      ).length
    : 0;

  useTabTitleNotifications(unreadNotifs + unreadMessages);

  const handleSplashComplete = useCallback(() => {
    markLoginSplashAsShown();
    setShowLoginSplash(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      resetLoginSplash();
    }
  }, [authLoading, currentUser]);

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
        resetLoginSplash();
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
    return <LoginSplash userName={currentUser.name} onComplete={handleSplashComplete} />;
  }

  return (
    <>
      <ReminderPopup />
      <BulletinAlertPopup />
      <AdminPopupAlert />
      <NewTaskPopup />
      <ForcePasswordChangeDialog />

      <div className="flex min-h-[100dvh] overflow-hidden bg-background">
        {!isMobile && (
          <AppSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        )}

        <div className="flex h-[100dvh] max-h-[100dvh] min-w-0 flex-1 flex-col">
          <header className="relative z-30 flex min-h-14 shrink-0 items-center gap-1.5 border-b border-border/70 bg-background/85 px-2 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-3 md:px-5">
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
                    <AppSidebar
                      mobile
                      collapsed={false}
                      onNavigate={() => setSidebarOpen(false)}
                    />
                  </SheetContent>
                </Sheet>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-none text-foreground md:text-base">
                  {pageTitle}
                </p>
                <p className="mt-1 hidden truncate text-[11px] text-muted-foreground sm:block">
                  JapanFlow · Japan Imports
                </p>
              </div>
            </div>

            <div className="mx-auto hidden min-w-0 flex-1 justify-center px-4 lg:flex">
              <div className="max-w-xl overflow-hidden">
                <InventoryHeaderBanner />
              </div>
            </div>

            <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1 md:gap-1.5">
              <PauseButton updatePresence={updatePresenceStatus} />
              <ThemeSwitcher />
              <NotificationBell />
            </div>
          </header>

          <main
            id="main-content"
            className={
              isChatRoute
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2 md:p-3'
                : 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-5 lg:p-6'
            }
          >
            <div
              className={
                isChatRoute
                  ? 'flex min-h-0 flex-1 flex-col'
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