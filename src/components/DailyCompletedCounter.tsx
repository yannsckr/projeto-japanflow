import { CheckCircle2 } from 'lucide-react';

import { useApp } from '@/contexts/AppContext';

interface DailyCompletedCounterProps {
  userId?: string;
  compact?: boolean;
}

const DailyCompletedCounter = ({ userId, compact }: DailyCompletedCounterProps) => {
  const { tasks } = useApp();

  const today = new Date().toDateString();

  const relevantTasks = userId ? tasks.filter((task) => task.assigneeId === userId) : tasks;

  const completedToday = relevantTasks.filter((task) => {
    if (task.status !== 'done') return false;

    const entries = task.statusHistory?.filter((history) => history.status === 'done');
    const doneEntry = entries?.[entries.length - 1];

    if (!doneEntry) return false;

    return new Date(doneEntry.enteredAt).toDateString() === today;
  }).length;

  if (compact) {
    return (
      <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 shadow-sm">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success">
          <CheckCircle2 className="h-4 w-4" />
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold leading-none text-foreground">
            {completedToday}
          </span>
          <span className="text-[11px] leading-none text-muted-foreground">hoje</span>
        </div>
      </div>
    );
  }

  return (
    <div className="jf-surface flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
        <CheckCircle2 className="h-5 w-5" />
      </div>

      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{completedToday}</p>
        <p className="text-xs text-muted-foreground">Concluídas hoje</p>
      </div>
    </div>
  );
};

export default DailyCompletedCounter;
