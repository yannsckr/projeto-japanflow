import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
import AppLayout from '@/components/AppLayout';
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const AdminMonitorPage = lazy(() => import('@/pages/AdminMonitorPage'));
const EmployeeBoardPage = lazy(() => import('@/pages/EmployeeBoardPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const ReferencesPage = lazy(() => import('@/pages/ReferencesPage'));
const CorporateToolsPage = lazy(() => import('@/pages/CorporateToolsPage'));
const DepartmentalPage = lazy(() => import('@/pages/DepartmentalPage'));
const MotoboyTrackingPage = lazy(() => import('@/pages/MotoboyTrackingPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const FinancialPage = lazy(() => import('@/pages/FinancialPage'));
const CorridasPage = lazy(() => import('@/pages/CorridasPage'));
const TimeReportsPage = lazy(() => import('@/pages/TimeReportsPage'));
const TaskTrackingPage = lazy(() => import('@/pages/TaskTrackingPage'));
const AwardsPage = lazy(() => import('@/pages/AwardsPage'));
const PedidoComprasPage = lazy(() => import('@/pages/PedidoComprasPage'));
const CounterOrdersPage = lazy(() => import('@/pages/CounterOrdersPage'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const AdminBackfillImagesPage = lazy(() => import('@/pages/AdminBackfillImagesPage'));
const SharedDocsPage = lazy(() => import('@/pages/SharedDocsPage'));
const InternalPoliciesPage = lazy(() => import('@/pages/InternalPoliciesPage'));
const ChatHistoryPage = lazy(() => import('@/pages/ChatHistoryPage'));
const GASPage = lazy(() => import('@/pages/GASPage'));
const SentinelPage = lazy(() => import('@/pages/SentinelPage'));
const BacklogPage = lazy(() => import('@/pages/BacklogPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const queryClient = new QueryClient();
const CarregandoPagina = () => (
  <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center">
    <span className="text-sm text-muted-foreground">Carregando página...</span>
  </div>
);
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppProvider>
          <Suspense fallback={<CarregandoPagina />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/monitor" element={<AdminMonitorPage />} />
                <Route path="/admin/employee/:employeeId" element={<EmployeeBoardPage />} />
                <Route path="/board" element={<EmployeeBoardPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/referencias" element={<ReferencesPage />} />
                <Route path="/corporate" element={<CorporateToolsPage />} />
                <Route path="/departmental" element={<DepartmentalPage />} />
                <Route path="/departmental/motoboys/mapa" element={<MotoboyTrackingPage />} />
                <Route path="/financial" element={<FinancialPage />} />
                <Route path="/corridas" element={<CorridasPage />} />
                <Route path="/time-reports" element={<TimeReportsPage />} />
                <Route path="/tracking" element={<TaskTrackingPage />} />
                <Route path="/awards" element={<AwardsPage />} />
                <Route path="/pedido-compras" element={<PedidoComprasPage />} />
                <Route path="/encomendas-balcao" element={<CounterOrdersPage />} />
                <Route path="/inventario" element={<InventoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin/backfill-images" element={<AdminBackfillImagesPage />} />
                <Route path="/documentos" element={<SharedDocsPage />} />
                <Route path="/politicas-internas" element={<InternalPoliciesPage />} />
                <Route path="/historico-conversas" element={<ChatHistoryPage />} />
                <Route path="/gas" element={<GASPage />} />
                <Route path="/sentinel" element={<SentinelPage />} />
                <Route path="/backlog" element={<BacklogPage />} />
              </Route>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
