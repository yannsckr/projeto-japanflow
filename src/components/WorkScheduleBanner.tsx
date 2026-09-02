import { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useWorkSchedules } from '@/hooks/useWorkSchedules';
import {
  DAY_KEYS,
  DAY_SHORT,
  WeekDays,
  addWeeks,
  emptyWeek,
  formatWeekRange,
  mondayOf,
  todayDayKey,
} from '@/lib/workSchedule';

interface Props {
  userId: string;
}

const formatRange = (d: { entry?: string; exit?: string }) => {
  if (d?.entry && d?.exit) return `${d.entry} – ${d.exit}`;
  return 'Folga';
};

const WorkScheduleBanner = ({ userId }: Props) => {
  const { schedules } = useWorkSchedules(userId);
  const [open, setOpen] = useState(false);
  const [viewWeek, setViewWeek] = useState<string>(mondayOf(new Date()));

  const currentWeekStart = mondayOf(new Date());
  const currentSchedule = useMemo(
    () => schedules.find((s) => s.week_start === currentWeekStart),
    [schedules, currentWeekStart]
  );
  const today = todayDayKey();

  const days: WeekDays = currentSchedule?.days || emptyWeek();
  const todayInfo = days[today];

  const viewSchedule = schedules.find((s) => s.week_start === viewWeek);
  const viewDays: WeekDays = viewSchedule?.days || emptyWeek();

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg px-3 py-2 flex flex-wrap items-center gap-3 justify-between">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Hoje:</span>
          <span className="text-sm font-bold">{formatRange(todayInfo)}</span>
        </div>
        <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
          {DAY_KEYS.map((d) => (
            <span
              key={d}
              className={`px-2 py-0.5 rounded border ${
                d === today
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background'
              }`}
            >
              <b>{DAY_SHORT[d]}</b> {formatRange(days[d])}
            </span>
          ))}
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setViewWeek(currentWeekStart);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">Escalas</Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Minhas Escalas</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={() => setViewWeek((w) => addWeeks(w, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium text-sm">
              Semana de {formatWeekRange(viewWeek)}
              {viewWeek === currentWeekStart && ' (atual)'}
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewWeek((w) => addWeeks(w, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {DAY_KEYS.map((d) => (
              <div key={d} className="flex justify-between text-sm border-b py-2">
                <span className="font-medium">{DAY_SHORT[d]}</span>
                <span className={viewSchedule ? '' : 'text-muted-foreground'}>
                  {formatRange(viewDays[d])}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Intervalo fixo de almoço: 1 hora.
          </p>
          {!viewSchedule && (
            <p className="text-xs text-muted-foreground text-center">
              Nenhuma escala cadastrada para esta semana.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkScheduleBanner;
