import { useApp } from '@/contexts/AppContext';
import { Navigate } from 'react-router-dom';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import ManageEmployeesDialog from '@/components/ManageEmployeesDialog';
import AdminCalendarView from '@/components/AdminCalendarView';
import TaskHistoryDialog from '@/components/TaskHistoryDialog';
import ManageTaskPermissionsDialog from '@/components/ManageTaskPermissionsDialog';
import ManageTabPermissionsDialog from '@/components/ManageTabPermissionsDialog';
import ManageFeaturePermissionsDialog from '@/components/ManageFeaturePermissionsDialog';
import { Switch } from '@/components/ui/switch';
import ScheduledTasksManager from '@/components/ScheduledTasksManager';
import SchedulesManagerDialog from '@/components/SchedulesManagerDialog';
import ManageExternalAccessDialog from '@/components/ManageExternalAccessDialog';

const AdminMonitorPage = () => {
  const {
    currentUser,
    sectorAssignEnabled,
    setSectorAssignEnabled,
    nfToCarolEnabled,
    setNfToCarolEnabled,
    nfBoletoToCarolEnabled,
    setNfBoletoToCarolEnabled,
  } = useApp();

  if (!currentUser || currentUser.role !== 'admin') return <Navigate to="/login" replace />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Monitoria</h2>
          <p className="text-sm text-muted-foreground">Visão geral</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              checked={sectorAssignEnabled}
              onCheckedChange={setSectorAssignEnabled}
              id="sector-assign-toggle"
            />
            <label
              htmlFor="sector-assign-toggle"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Tarefa p/ Setor
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={nfToCarolEnabled}
              onCheckedChange={setNfToCarolEnabled}
              id="nf-carol-toggle"
            />
            <label
              htmlFor="nf-carol-toggle"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              NF p/ Carol
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={nfBoletoToCarolEnabled}
              onCheckedChange={setNfBoletoToCarolEnabled}
              id="nf-boleto-carol-toggle"
            />
            <label
              htmlFor="nf-boleto-carol-toggle"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              NF + Boleto p/ Carol
            </label>
          </div>
          <TaskHistoryDialog />
          <SchedulesManagerDialog />
          <ManageTaskPermissionsDialog />
          <ManageTabPermissionsDialog />
          <ManageFeaturePermissionsDialog />
          <ManageExternalAccessDialog />
          <ManageEmployeesDialog />
          <CreateTaskDialog />
        </div>
      </div>

      <div className="mt-6">
        <ScheduledTasksManager />
      </div>

      <div className="mt-6">
        <AdminCalendarView />
      </div>
    </div>
  );
};

export default AdminMonitorPage;
