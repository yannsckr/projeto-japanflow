import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';
import AdminMonitorPage from '@/pages/AdminMonitorPage';
import EmployeeBoardPage from '@/pages/EmployeeBoardPage';
import ChatPage from '@/pages/ChatPage';
import CorporateToolsPage from '@/pages/CorporateToolsPage';
import DepartmentalPage from '@/pages/DepartmentalPage';
import ProfilePage from '@/pages/ProfilePage';
import FinancialPage from '@/pages/FinancialPage';
import CorridasPage from '@/pages/CorridasPage';
import TimeReportsPage from '@/pages/TimeReportsPage';
import TaskTrackingPage from '@/pages/TaskTrackingPage';
import AwardsPage from '@/pages/AwardsPage';
import PedidoComprasPage from '@/pages/PedidoComprasPage';
import CounterOrdersPage from '@/pages/CounterOrdersPage';
import InventoryPage from '@/pages/InventoryPage';
import AdminBackfillImagesPage from '@/pages/AdminBackfillImagesPage';
import SharedDocsPage from '@/pages/SharedDocsPage';
import InternalPoliciesPage from '@/pages/InternalPoliciesPage';
import ChatHistoryPage from '@/pages/ChatHistoryPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/monitor" element={<AdminMonitorPage />} />
              <Route path="/admin/employee/:employeeId" element={<EmployeeBoardPage />} />
              <Route path="/board" element={<EmployeeBoardPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/corporate" element={<CorporateToolsPage />} />
              <Route path="/departmental" element={<DepartmentalPage />} />
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
            </Route>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
