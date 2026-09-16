import { Navigate } from 'react-router-dom';

import { useApp } from '@/contexts/AppContext';
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

  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const tasks = getTasksForUser(currentUser.id);

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="jf-surface overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Meu espaço
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Meu Quadro
            </h1>

            <p className="mt-1.5 text-sm text-muted-foreground">
              {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} vinculada
              {tasks.length !== 1 ? 's' : ''} ao seu quadro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DailyCompletedCounter userId={currentUser.id} compact />
            <TaskHistoryDialog userId={currentUser.id} />
            <CreateTaskDialog />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <WorkScheduleBanner userId={currentUser.id} />

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0">
            <PickupsPanel />
          </div>

          <div className="min-w-0">
            <SectorTasksList userId={currentUser.id} />
          </div>
        </div>
      </section>

      <section className="min-w-0">
        <KanbanBoard tasks={tasks} />
      </section>

      <section className="min-w-0">
        <EmployeeCalendar userId={currentUser.id} />
      </section>
    </div>
  );
};

export default AdminPage;
