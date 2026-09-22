import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, CircleDashed, Clock3, PauseCircle, UserRound } from 'lucide-react';

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
import { SECTOR_LABELS, Sector } from '@/types';

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

  const stats = useMemo(
    () => ({
      todo: tasks.filter((task) => task.status === 'todo').length,
      inProgress: tasks.filter((task) => task.status === 'in_progress').length,
      paused: tasks.filter((task) => task.status === 'paused').length,
      done: tasks.filter((task) => task.status === 'done').length,
    }),
    [tasks]
  );

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 md:space-y-6">
      <WorkScheduleBanner userId={viewUserId} />

      <section className="jf-diagonal-accent overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {isAdmin ? 'Equipe' : 'Meu espaço'}
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                  {boardTitle}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} vinculada
                    {tasks.length !== 1 ? 's' : ''}
                  </span>
                  {viewUser?.function && (
                    <>
                      <span>•</span>
                      <span>{viewUser.function}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!!viewUser?.sectors?.length && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {viewUser.sectors.map((sector) => (
                  <span
                    key={sector}
                    className="rounded-lg border border-border/70 bg-muted/35 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                  >
                    {SECTOR_LABELS[sector as Sector]}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DailyCompletedCounter userId={viewUserId} compact />
            <TaskHistoryDialog userId={viewUserId} />
            {isAdmin && <CreateTaskDialog preselectedAssignee={viewUserId} />}
            {!isAdmin && showCreateTask && <CreateTaskDialog />}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['todo', stats.todo, 'A fazer', CircleDashed, 'bg-primary/10 text-primary'],
          ['progress', stats.inProgress, 'Em andamento', Clock3, 'bg-warning/10 text-warning'],
          ['paused', stats.paused, 'Pausadas', PauseCircle, 'bg-muted text-muted-foreground'],
          ['done', stats.done, 'Concluídas', CheckCircle2, 'bg-success/10 text-success'],
        ].map(([key, value, label, Icon, style]: any) => (
          <div key={key} className="jf-surface flex items-center gap-3 p-3.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${style}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">{value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-2">
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
