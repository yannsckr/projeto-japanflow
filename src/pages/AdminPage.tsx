import { useApp } from '@/contexts/AppContext';
import { Navigate } from 'react-router-dom';
import { useTaskPermissions } from '@/hooks/useTaskPermissions';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import EmployeeCalendar from '@/components/EmployeeCalendar';
import DailyCompletedCounter from '@/components/DailyCompletedCounter';
import SectorTasksList from '@/components/SectorTasksList';
import TaskHistoryDialog from '@/components/TaskHistoryDialog';
import PickupsPanel from '@/components/PickupsPanel';
import WorkScheduleBanner from '@/components/WorkScheduleBanner';

const AdminPage = () => {
  const { currentUser, getTasksForUser } = useApp();

  if (!currentUser || currentUser.role !== 'admin') return <Navigate to="/login" replace />;

  const tasks = getTasksForUser(currentUser.id);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Meu Quadro</h2>
            <p className="text-sm text-muted-foreground">
              {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DailyCompletedCounter userId={currentUser.id} compact />
            <TaskHistoryDialog userId={currentUser.id} />
            <CreateTaskDialog />
          </div>
        </div>

        <div className="mb-4">
          <WorkScheduleBanner userId={currentUser.id} />
        </div>

        <div className="mb-6">
          <PickupsPanel />
        </div>

        <KanbanBoard tasks={tasks} />
      </div>

      <SectorTasksList userId={currentUser.id} />

      <EmployeeCalendar userId={currentUser.id} />
    </div>
  );
};

export default AdminPage;
