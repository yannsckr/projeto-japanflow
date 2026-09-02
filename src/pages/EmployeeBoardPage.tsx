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

  const viewUser = users.find((u) => u.id === viewUserId);
  const tasks = getTasksForUser(viewUserId);

  const hasPermissions =
    currentUser && !permissionsLoading
      ? permissions.some((p) => p.granterId === currentUser.id)
      : false;
  const showCreateTask = isAdmin || hasPermissions;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">
              {isAdmin ? `Quadro de ${viewUser?.name}` : 'Meu Quadro'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DailyCompletedCounter userId={viewUserId} compact />
            <TaskHistoryDialog userId={viewUserId} />
            {isAdmin && <CreateTaskDialog preselectedAssignee={viewUserId} />}
            {!isAdmin && showCreateTask && <CreateTaskDialog />}
          </div>
        </div>

        <div className="mb-4">
          <WorkScheduleBanner userId={viewUserId} />
        </div>

        <div className="mb-6">
          <PickupsPanel />
        </div>

        <div className="mb-6">
          <CounterOrdersPanel />
        </div>

        {!isAdmin && <SectorTasksList userId={viewUserId} />}

        <KanbanBoard tasks={tasks} />
      </div>

      <EmployeeCalendar userId={viewUserId} />
    </div>
  );
};

export default EmployeeBoardPage;
