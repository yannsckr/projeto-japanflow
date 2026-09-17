import { Navigate } from 'react-router-dom';

import { useApp } from '@/contexts/AppContext';
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

  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-w-0 space-y-5 md:space-y-6">
      <section className="jf-surface overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Administração
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Monitoria</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Controles, permissões e visão geral da operação.
            </p>
          </div>

          <div className="w-full space-y-3 xl:max-w-[980px]">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <label
                htmlFor="sector-assign-toggle"
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/20 px-3 py-2.5"
              >
                <span className="text-sm text-muted-foreground">Tarefa p/ Setor</span>
                <Switch
                  checked={sectorAssignEnabled}
                  onCheckedChange={setSectorAssignEnabled}
                  id="sector-assign-toggle"
                />
              </label>

              <label
                htmlFor="nf-carol-toggle"
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/20 px-3 py-2.5"
              >
                <span className="text-sm text-muted-foreground">NF p/ Carol</span>
                <Switch
                  checked={nfToCarolEnabled}
                  onCheckedChange={setNfToCarolEnabled}
                  id="nf-carol-toggle"
                />
              </label>

              <label
                htmlFor="nf-boleto-carol-toggle"
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/20 px-3 py-2.5 sm:col-span-2 xl:col-span-1"
              >
                <span className="text-sm text-muted-foreground">NF + Boleto p/ Carol</span>
                <Switch
                  checked={nfBoletoToCarolEnabled}
                  onCheckedChange={setNfBoletoToCarolEnabled}
                  id="nf-boleto-carol-toggle"
                />
              </label>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap xl:justify-end [&_button]:min-h-9 [&_button]:w-full xl:[&_button]:w-auto">
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
        </div>
      </section>

      <section className="min-w-0">
        <ScheduledTasksManager />
      </section>

      <section className="min-w-0">
        <AdminCalendarView />
      </section>
    </div>
  );
};

export default AdminMonitorPage;
