import { useApp } from '@/contexts/AppContext';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import NotificationBell from './NotificationBell';
import PauseButton from './PauseButton';
import ReminderPopup from './ReminderPopup';
import BulletinAlertPopup from './BulletinAlertPopup';
import AdminPopupAlert from './AdminPopupAlert';
import NewTaskPopup from './NewTaskPopup';
import InventoryHeaderBanner from './InventoryHeaderBanner';
import { useThemeToggle } from '@/hooks/useThemeToggle';
import { usePresence } from '@/hooks/usePresence';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTabTitleNotifications } from '@/hooks/useTabTitleNotifications';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { Sun, Moon, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import logoImg from '@/assets/logo_japanflow.png';
import { useState, useEffect } from 'react';
import { getClientPublicIp, isIpAllowed } from '@/lib/networkGuard';
import { userCanAccessExternally } from '@/lib/externalAccess';

const AppLayout = () => {
  const { currentUser, logout, notifications } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeToggle();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isChatRoute = location.pathname === '/chat';

  const { updatePresenceStatus } = usePresence(currentUser?.id || null);
  usePushNotifications();

  const { totalUnread: unreadMessages } = useUnreadMessages(currentUser?.id || null);
  const unreadNotifs = currentUser
    ? notifications.filter((n) => n.userId === currentUser.id && !n.read).length
    : 0;

  useTabTitleNotifications(unreadNotifs + unreadMessages);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') return;

    let cancelled = false;

    (async () => {
      const ip = await getClientPublicIp();
      if (cancelled) return;
      if (isIpAllowed(ip)) return;

      const allowed = await userCanAccessExternally(currentUser.id);
      if (cancelled) return;

      if (!allowed) {
        logout();
        navigate('/login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, logout, navigate]);

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      <ReminderPopup />
      <BulletinAlertPopup />
      <AdminPopupAlert />
      <NewTaskPopup />
      {!isMobile && <AppSidebar />}

      <div className="flex-1 flex flex-col h-screen max-h-screen min-w-0">
        <header className="h-14 border-b border-border bg-black flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 border-r-0 h-full flex flex-col">
                  <AppSidebar onNavigate={() => setSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
            )}
            <img src={logoImg} alt="JapanFlow" className="h-8 md:h-10 object-contain" />
          </div>

          <InventoryHeaderBanner />

          <div className="flex items-center gap-1 md:gap-2">
            <PauseButton updatePresence={updatePresenceStatus} />
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <NotificationBell />
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        <main
          className={
            isChatRoute
              ? 'flex-1 min-h-0 p-2 md:p-3 overflow-hidden flex flex-col max-h-[calc(100dvh-3.5rem)]'
              : 'flex-1 min-h-0 p-3 md:p-6 overflow-auto'
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
