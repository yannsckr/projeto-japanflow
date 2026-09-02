import { useApp } from '@/contexts/AppContext';
import { CheckCircle2 } from 'lucide-react';

interface DailyCompletedCounterProps {
  userId?: string;
  compact?: boolean;
}

const DailyCompletedCounter = ({ userId, compact }: DailyCompletedCounterProps) => {
  const { tasks } = useApp();

  const today = new Date().toDateString();

  const relevantTasks = userId ? tasks.filter((t) => t.assigneeId === userId) : tasks;
  const completedToday = relevantTasks.filter((t) => {
    if (t.status !== 'done') return false;
    const entries = t.statusHistory?.filter((h) => h.status === 'done');
    const doneEntry = entries?.[entries.length - 1];
    if (!doneEntry) return false;
    return new Date(doneEntry.enteredAt).toDateString() === today;
  }).length;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-card">
        <CheckCircle2 className="w-4 h-4 text-success" />
        <span className="text-sm font-semibold leading-none">{completedToday}</span>
        <span className="text-xs text-muted-foreground leading-none">Concluídas Hoje</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success">
        <CheckCircle2 className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{completedToday}</p>
        <p className="text-xs text-muted-foreground">Concluídas Hoje</p>
      </div>
    </div>
  );
};

export default DailyCompletedCounter;
