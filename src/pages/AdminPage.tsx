import { Navigate } from 'react-router-dom';

import { useApp } from '@/contexts/AppContext';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import EmployeeCalendar from '@/components/EmployeeCalendar';
import DailyCompletedCounter from '@/components/DailyCompletedCounter';
import TaskHistoryDialog from '@/components/TaskHistoryDialog';
import WorkScheduleBanner from '@/components/WorkScheduleBanner';
import PickupsPanel from '@/components/PickupsPanel';

const AdminPage = () => {
  const { currentUser, getTasksForUser } = useApp();

  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const tasks = getTasksForUser(currentUser.id);

  return (
    <div className="min-w-0 space-y-5 md:space-y-6">
      <section className="min-w-0">
        <WorkScheduleBanner userId={currentUser.id} />
      </section>

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

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto lg:flex lg:flex-wrap lg:items-center [&_button]:w-full lg:[&_button]:w-auto">
            <DailyCompletedCounter userId={currentUser.id} compact />
            <TaskHistoryDialog userId={currentUser.id} />
            <CreateTaskDialog />
          </div>
        </div>
      </section>

      <section className="min-w-0">
        <PickupsPanel />
      </section>

      <section className="min-w-0 overflow-hidden">
        <KanbanBoard tasks={tasks} />
      </section>

      <section className="min-w-0">
        <EmployeeCalendar userId={currentUser.id} />
      </section>
    </div>
  );
};

export default AdminPage;
