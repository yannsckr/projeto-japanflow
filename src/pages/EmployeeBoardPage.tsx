import { useParams } from 'react-router-dom';

import { useApp } from '@/contexts/AppContext';
import { useTaskPermissions } from '@/hooks/useTaskPermissions';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import EmployeeCalendar from '@/components/EmployeeCalendar';
import DailyCompletedCounter from '@/components/DailyCompletedCounter';
import SectorTasksList from '@/components/SectorTasksList';
import TaskHistoryDialog from '@/components/TaskHistoryDialog';
import PickupsPanel from '@/components/PickupsPanel';
import CounterOrdersPanel from '@/components/CounterOrdersPanel';
import WorkScheduleBanner from '@/components/WorkScheduleBanner';

const EmployeeBoardPage = () => {
  const { employeeId } = useParams();
  const { currentUser, users, getTasksForUser } = useApp();
  const { permissions, loading: permissionsLoading } = useTaskPermissions();

  const isAdmin = currentUser?.role === 'admin';
  const viewUserId = isAdmin && employeeId ? employeeId : currentUser?.id;

  if (!viewUserId) return null;

  const viewUser = users.find((user) => user.id === viewUserId);
  const tasks = getTasksForUser(viewUserId);

  const hasPermissions =
    currentUser && !permissionsLoading
      ? permissions.some((permission) => permission.granterId === currentUser.id)
      : false;

  const showCreateTask = isAdmin || hasPermissions;
  const boardTitle = isAdmin ? `Quadro de ${viewUser?.name ?? 'colaborador'}` : 'Meu Quadro';

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="jf-surface overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {isAdmin ? 'Equipe' : 'Meu espaço'}
            </p>

            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {boardTitle}
            </h1>

            <p className="mt-1.5 text-sm text-muted-foreground">
              {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} vinculada
              {tasks.length !== 1 ? 's' : ''} a este quadro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DailyCompletedCounter userId={viewUserId} compact />
            <TaskHistoryDialog userId={viewUserId} />

            {isAdmin && <CreateTaskDialog preselectedAssignee={viewUserId} />}

            {!isAdmin && showCreateTask && <CreateTaskDialog />}
          </div>
        </div>
      </section>

      <section>
        <WorkScheduleBanner userId={viewUserId} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <PickupsPanel />
        </div>

        <div className="min-w-0">
          <CounterOrdersPanel />
        </div>
      </section>

      {!isAdmin && (
        <section className="min-w-0">
          <SectorTasksList userId={viewUserId} />
        </section>
      )}

      <section className="min-w-0">
        <KanbanBoard tasks={tasks} />
      </section>

      <section className="min-w-0">
        <EmployeeCalendar userId={viewUserId} />
      </section>
    </div>
  );
};

export default EmployeeBoardPage;
