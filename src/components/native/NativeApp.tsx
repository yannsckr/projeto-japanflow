import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AppProvider } from '@/contexts/AppContext';
import NativeShell, { type NativePlatform } from './NativeShell';

// Reutilizamos fluxos e serviços já existentes, mas NÃO a aplicação web/AppLayout.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const EmployeeBoardPage = lazy(() => import('@/pages/EmployeeBoardPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const TaskTrackingPage = lazy(() => import('@/pages/TaskTrackingPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const MotoboyTrackingPage = lazy(() => import('@/pages/MotoboyTrackingPage'));
const DriveScreen = lazy(() => import('@/cosmos/shared/components/DriveScreen'));

const queryClient = new QueryClient();

export default function NativeApp({ platform }: { platform: NativePlatform }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <AppProvider>
            <Suspense
              fallback={
                <div className="p-8 text-sm text-muted-foreground">Carregando COSMOS...</div>
              }
            >
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<NativeShell platform={platform} />}>
                  <Route path="/board" element={<EmployeeBoardPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/tracking" element={<TaskTrackingPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/drive" element={<DriveScreen />} />
                  <Route path="/departmental/motoboys/mapa" element={<MotoboyTrackingPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/board" replace />} />
              </Routes>
            </Suspense>
          </AppProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
