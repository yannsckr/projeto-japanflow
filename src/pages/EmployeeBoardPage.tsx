import { useParams } from 'react-router-dom';
import { UserRound } from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { useTaskPermissions } from '@/hooks/useTaskPermissions';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import EmployeeCalendar from '@/components/EmployeeCalendar';
import DailyCompletedCounter from '@/components/DailyCompletedCounter';
import TaskHistoryDialog from '@/components/TaskHistoryDialog';
import WorkScheduleBanner from '@/components/WorkScheduleBanner';
import { SECTOR_LABELS, Sector } from '@/types';

const EmployeeBoardPage = () => {
  const { employeeId } = useParams();
  const { currentUser, users, getTasksForUser } = useApp();
  const { permissions, loading: permissionsLoading } = useTaskPermissions();

  const isAdmin = currentUser?.role === 'admin';

  const viewUserId = isAdmin && employeeId ? employeeId : currentUser?.id;

  const viewUser = viewUserId ? users.find((user) => user.id === viewUserId) : undefined;

  const tasks = viewUserId ? getTasksForUser(viewUserId) : [];
  const activeTaskCount = tasks.filter(
    (task) => !(task as typeof task & { archivedAt?: string }).archivedAt
  ).length;

  const hasPermissions =
    currentUser && !permissionsLoading
      ? permissions.some((permission) => permission.granterId === currentUser.id)
      : false;

  const showCreateTask = isAdmin || hasPermissions;

  const boardTitle = isAdmin ? `Quadro de ${viewUser?.name ?? 'colaborador'}` : 'Meu Quadro';

  if (!viewUserId) {
    return null;
  }

  return (
    <div className="w-full min-w-0 space-y-5 md:space-y-6">
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
                    {activeTaskCount} tarefa
                    {activeTaskCount !== 1 ? 's' : ''} vinculada
                    {activeTaskCount !== 1 ? 's' : ''}
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
