import { Suspense, lazy, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AppProvider, useApp } from '@/contexts/AppContext';
import NativeShell, { type NativePlatform } from './NativeShell';
import MotoboySplash from '@/cosmos/mobile/roles/motoboy/MotoboySplash';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const MobileLogin = lazy(() => import('@/cosmos/mobile/roles/motoboy/MotoboyLogin'));
const MotoboyHome = lazy(() => import('@/cosmos/mobile/roles/motoboy/MotoboyHome'));
const MotoboyRides = lazy(() => import('@/cosmos/mobile/roles/motoboy/MotoboyRides'));
const EmployeeBoardPage = lazy(() => import('@/pages/EmployeeBoardPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const TaskTrackingPage = lazy(() => import('@/pages/TaskTrackingPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const MotoboyTrackingPage = lazy(() => import('@/pages/MotoboyTrackingPage'));
const DriveScreen = lazy(() => import('@/components/cosmos/shared/components/DriveScreen'));
const queryClient = new QueryClient();

function MotoboyGate({ children }: { children: ReactNode }) {
  const { currentUser, authLoading } = useApp();
  const location = useLocation();
  if (authLoading)
    return (
      <p role="status" className="p-8">
        Validando sessão…
      </p>
    );
  if (!currentUser) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!currentUser.sectors?.includes('motoboys') && currentUser.role !== 'admin')
    return <Navigate to="/board" replace />;
  return <>{children}</>;
}

function HomeRedirect({ platform }: { platform: NativePlatform }) {
  const { currentUser, authLoading } = useApp();
  if (authLoading)
    return (
      <p role="status" className="p-8">
        Validando sessão…
      </p>
    );
  if (!currentUser) return <Navigate to="/login" replace />;
  if (platform === 'android' && currentUser.sectors?.includes('motoboys'))
    return <Navigate to="/motoboy" replace />;
  return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/board'} replace />;
}

function AppRoutes({ platform }: { platform: NativePlatform }) {
  return (
    <Suspense
      fallback={
        <div role="status" className="p-8 text-sm text-muted-foreground">
          Carregando JapanFlow…
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={platform === 'android' ? <MobileLogin /> : <LoginPage />} />
        {platform === 'android' && (
          <>
            <Route
              path="/motoboy"
              element={
                <MotoboyGate>
                  <MotoboyHome />
                </MotoboyGate>
              }
            />
            <Route
              path="/motoboy/corridas"
              element={
                <MotoboyGate>
                  <MotoboyRides />
                </MotoboyGate>
              }
            />
          </>
        )}
        <Route element={<NativeShell platform={platform} />}>
          <Route path="/board" element={<EmployeeBoardPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/tracking" element={<TaskTrackingPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/drive" element={<DriveScreen />} />
          <Route path="/departmental/motoboys/mapa" element={<MotoboyTrackingPage />} />
        </Route>
        <Route path="*" element={<HomeRedirect platform={platform} />} />
      </Routes>
    </Suspense>
  );
}

export default function NativeApp({ platform }: { platform: NativePlatform }) {
  const [showSplash, setShowSplash] = useState(platform === 'android');
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <AppProvider>
            {showSplash ? (
              <MotoboySplash onDone={() => setShowSplash(false)} />
            ) : (
              <AppRoutes platform={platform} />
            )}
          </AppProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
