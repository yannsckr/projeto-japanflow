import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

interface Props {
  userId?: string;
  compact?: boolean;
}

const SAO_PAULO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getSaoPauloDayKey = (value: string | Date | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return SAO_PAULO_DATE.format(date);
};

const DailyCompletedCounter = ({ userId, compact }: Props) => {
  const { tasks } = useApp();
  const [todayKey, setTodayKey] = useState(() => getSaoPauloDayKey(new Date()));

  useEffect(() => {
    const syncDay = () => {
      const nextDayKey = getSaoPauloDayKey(new Date());
      setTodayKey((current) => (current === nextDayKey ? current : nextDayKey));
    };

    syncDay();
    const interval = window.setInterval(syncDay, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncDay();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const completedToday = useMemo(() => {
    if (!todayKey) return 0;

    const relevant = userId ? tasks.filter((task) => task.assigneeId === userId) : tasks;

    return relevant.filter((task) => {
      if (task.status !== 'done') return false;

      const doneEntries = (task.statusHistory || [])
        .filter((entry) => entry.status === 'done' && entry.enteredAt)
        .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());

      const lastDone = doneEntries[doneEntries.length - 1];
      const completedAt = lastDone?.enteredAt || task.updatedAt || task.createdAt;

      return getSaoPauloDayKey(completedAt) === todayKey;
    }).length;
  }, [tasks, todayKey, userId]);

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
