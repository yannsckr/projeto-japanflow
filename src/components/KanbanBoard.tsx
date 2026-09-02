import { useState } from 'react';
import { Task, TaskStatus, STATUS_LABELS, Sector } from '@/types';
import { useApp } from '@/contexts/AppContext';
import TaskCard from './TaskCard';
import TaskDetailDialog from './TaskDetailDialog';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

const ALL_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'paused', 'done'];
const MOTOBOY_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

const COLUMN_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-primary/10 text-primary',
  in_progress: 'bg-warning/10 text-warning',
  paused: 'bg-muted text-muted-foreground',
  done: 'bg-success/10 text-success',
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

  return (
    <div className="flex-1 min-w-[280px] max-w-[340px]">
      <div className="flex items-center gap-2 mb-4">
        <span
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide',
            COLUMN_COLORS[status]
          )}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="text-xs text-muted-foreground font-medium">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'space-y-3 min-h-[200px] p-2 rounded-xl transition-colors',
          isOver && 'bg-accent/50 ring-2 ring-primary/20'
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

const KanbanBoard = ({ tasks }: KanbanBoardProps) => {
  const { updateTaskStatus, currentUser } = useApp();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const userIsMotoboy =
    currentUser?.sectors?.includes('motoboys' as Sector) && currentUser?.role !== 'admin';
  const hasMotoTasks = tasks.some((t) => t.sector === 'motoboys');
  const COLUMNS = userIsMotoboy && hasMotoTasks ? MOTOBOY_COLUMNS : ALL_COLUMNS;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    if (COLUMNS.includes(overId as TaskStatus)) {
      updateTaskStatus(taskId, overId as TaskStatus);
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        updateTaskStatus(taskId, overTask.status);
      }
    }
  };

  const getColumnTasks = (status: TaskStatus) => {
    const filtered = tasks.filter((t) => t.status === status);
    if (status === 'done') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return filtered.filter((t) => {
        const doneEntries = t.statusHistory?.filter((h) => h.status === 'done');
        const lastDone = doneEntries?.[doneEntries.length - 1];
        if (!lastDone) return true;
        return new Date(lastDone.enteredAt).getTime() >= todayStart.getTime();
      });
    }
    return filtered;
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={getColumnTasks(status)}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>
        <DragOverlay>{activeTask && <TaskCard task={activeTask} />}</DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </>
  );
};

export default KanbanBoard;
