import { CheckCircle2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

interface Props {
  userId?: string;
  compact?: boolean;
}

const isSameLocalDay = (value: string | undefined, ref: Date) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
};

const DailyCompletedCounter = ({ userId, compact }: Props) => {
  const { tasks } = useApp();
  const now = new Date();
  const relevant = userId ? tasks.filter((t) => t.assigneeId === userId) : tasks;

  const completedToday = relevant.filter((task) => {
    if (task.status !== 'done') return false;
    const doneEntries = (task.statusHistory || [])
      .filter((h) => h.status === 'done' && h.enteredAt)
      .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());
    const lastDone = doneEntries[doneEntries.length - 1];
    if (lastDone?.enteredAt) return isSameLocalDay(lastDone.enteredAt, now);
    return isSameLocalDay(task.updatedAt || task.createdAt, now);
  }).length;

  if (compact)
    return (
      <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 shadow-sm">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold">{completedToday}</span>
          <span className="text-[11px] text-muted-foreground">hoje</span>
        </div>
      </div>
    );

  return (
    <div className="jf-surface flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{completedToday}</p>
        <p className="text-xs text-muted-foreground">Concluídas hoje</p>
      </div>
    </div>
  );
};
export default DailyCompletedCounter;
