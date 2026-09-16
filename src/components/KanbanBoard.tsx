import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { Task, TaskStatus, STATUS_LABELS, Sector } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import TaskCard from './TaskCard';
import TaskDetailDialog from './TaskDetailDialog';

const ALL_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'paused', 'done'];
const MOTOBOY_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

const COLUMN_STYLES: Record<TaskStatus, { badge: string; dot: string }> = {
  todo: {
    badge: 'bg-primary/10 text-primary',
    dot: 'bg-primary',
  },
  in_progress: {
    badge: 'bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  paused: {
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground/60',
  },
  done: {
    badge: 'bg-success/10 text-success',
    dot: 'bg-success',
  },
};

interface KanbanBoardProps {
  tasks: Task[];
  showAssignee?: boolean;
}

const KanbanColumn = ({
  status,
  tasks,
  onTaskClick,
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const styles = COLUMN_STYLES[status];

  return (
    <section className="min-w-[280px] flex-1 md:min-w-[300px] xl:min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', styles.dot)} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {STATUS_LABELS[status]}
          </span>
        </div>

        <span
          className={cn(
            'inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold',
            styles.badge
          )}
        >
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[260px] rounded-2xl border border-border/70 bg-muted/20 p-2.5 transition-all duration-220 ease-premium',
          isOver &&
            'border-primary/40 bg-primary/[0.035] shadow-[0_0_0_3px_hsl(var(--brand-red)/0.06)]'
        )}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex min-h-[180px] items-center justify-center px-4 text-center">
            <p className="text-xs leading-5 text-muted-foreground/70">
              Nenhuma tarefa nesta etapa.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

const KanbanBoard = ({ tasks }: KanbanBoardProps) => {
  const { updateTaskStatus, currentUser } = useApp();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const userIsMotoboy =
    currentUser?.sectors?.includes('motoboys' as Sector) && currentUser?.role !== 'admin';
  const hasMotoTasks = tasks.some((task) => task.sector === 'motoboys');
  const columns = userIsMotoboy && hasMotoTasks ? MOTOBOY_COLUMNS : ALL_COLUMNS;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((item) => item.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    if (columns.includes(overId as TaskStatus)) {
      updateTaskStatus(taskId, overId as TaskStatus);
      return;
    }

    const overTask = tasks.find((task) => task.id === overId);
    if (overTask) {
      updateTaskStatus(taskId, overTask.status);
    }
  };

  const getColumnTasks = (status: TaskStatus) => {
    const filtered = tasks.filter((task) => task.status === status);

    if (status !== 'done') return filtered;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return filtered.filter((task) => {
      const doneEntries = task.statusHistory?.filter((history) => history.status === 'done');
      const lastDone = doneEntries?.[doneEntries.length - 1];

      if (!lastDone) return true;

      return new Date(lastDone.enteredAt).getTime() >= todayStart.getTime();
    });
  };

  return (
    <section className="jf-surface overflow-hidden p-3 md:p-4">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-semibold text-foreground">Fluxo de tarefas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Arraste os cards entre as etapas para atualizar o status.
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-2 xl:grid xl:grid-cols-4 xl:overflow-visible">
          {columns.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={getColumnTasks(status)}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rotate-[1deg] opacity-95 shadow-floating">
              <TaskCard task={activeTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </section>
  );
};

export default KanbanBoard;
