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

const formatRange = (day: { entry?: string; exit?: string }) => {
  if (day?.entry && day?.exit) return `${day.entry} – ${day.exit}`;
  return 'Folga';
};

const WorkScheduleBanner = ({ userId }: Props) => {
  const { schedules } = useWorkSchedules(userId);
  const [open, setOpen] = useState(false);
  const [viewWeek, setViewWeek] = useState<string>(mondayOf(new Date()));

  const currentWeekStart = mondayOf(new Date());
  const currentSchedule = useMemo(
    () => schedules.find((schedule) => schedule.week_start === currentWeekStart),
    [schedules, currentWeekStart]
  );

  const today = todayDayKey();
  const days: WeekDays = currentSchedule?.days || emptyWeek();
  const todayInfo = days[today];

  const viewSchedule = schedules.find((schedule) => schedule.week_start === viewWeek);
  const viewDays: WeekDays = viewSchedule?.days || emptyWeek();

  return (
    <div className="jf-surface flex flex-col gap-3 p-3.5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Calendar className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Escala de hoje
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {formatRange(todayInfo)}
          </p>
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pl-2 lg:flex">
          {DAY_KEYS.map((day) => (
            <span
              key={day}
              className={`whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] ${
                day === today
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/70 bg-muted/20 text-muted-foreground'
              }`}
            >
              <b>{DAY_SHORT[day]}</b> {formatRange(days[day])}
            </span>
          ))}
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setViewWeek(currentWeekStart);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 rounded-xl">
            Ver escalas
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Minhas Escalas</DialogTitle>
          </DialogHeader>

          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setViewWeek((week) => addWeeks(week, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center text-sm font-medium">
              Semana de {formatWeekRange(viewWeek)}
              {viewWeek === currentWeekStart && ' (atual)'}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setViewWeek((week) => addWeeks(week, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70">
            {DAY_KEYS.map((day) => (
              <div
                key={day}
                className="flex justify-between border-b border-border/60 px-3 py-2.5 text-sm last:border-b-0"
              >
                <span className="font-medium">{DAY_SHORT[day]}</span>
                <span className={viewSchedule ? '' : 'text-muted-foreground'}>
                  {formatRange(viewDays[day])}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Intervalo fixo de almoço: 1 hora.
          </p>

          {!viewSchedule && (
            <p className="text-center text-xs text-muted-foreground">
              Nenhuma escala cadastrada para esta semana.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkScheduleBanner;
