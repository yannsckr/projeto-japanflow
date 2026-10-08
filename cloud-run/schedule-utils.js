import { DateTime } from 'luxon';

const ZONE = 'America/Sao_Paulo';

export function calculateNextRunAt(schedule, now = DateTime.now()) {
  if (schedule.active === false) return null;

  const time = String(schedule.schedule_time ?? '08:00');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;

  const recurrence = schedule.recurrence === 'specific_days' ? 'specific_days' : 'daily';
  const days = Array.isArray(schedule.days_of_week)
    ? schedule.days_of_week.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  if (recurrence === 'specific_days' && days.length === 0) return null;

  const localNow = now.setZone(ZONE);
  const [hour, minute] = time.split(':').map(Number);
  for (let offset = 0; offset <= 7; offset++) {
    const localDay = localNow.startOf('day').plus({ days: offset });
    const dayNumber = localDay.weekday % 7;
    if (recurrence === 'specific_days' && !days.includes(dayNumber)) continue;

    const scheduled = localDay.set({ hour, minute, second: 0, millisecond: 0 });
    if (!scheduled.isValid) continue;
    const dayKey = scheduled.toFormat('yyyy-LL-dd');
    if (dayKey === schedule.last_occurrence_key) continue;

    // Se a execução de hoje está atrasada, mantemos hoje como devido,
    // mas nunca recriamos ocorrências de dias anteriores ao dia atual.
    return scheduled.toJSDate();
  }
  return null;
}
