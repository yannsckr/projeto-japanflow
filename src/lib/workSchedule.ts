export type DayKey =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DaySchedule {
  entry?: string;
  exit?: string;
  entry2?: string;
  exit2?: string;
}

export type WeekDays = Record<DayKey, DaySchedule>;

export const DAY_KEYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const DAY_SHORT: Record<DayKey, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

export function emptyWeek(): WeekDays {
  return DAY_KEYS.reduce((acc, k) => {
    acc[k] = { entry: '', exit: '', entry2: '', exit2: '' };
    return acc;
  }, {} as WeekDays);
}

/** Returns the Monday (YYYY-MM-DD) of the week containing `date`. */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addWeeks(weekStartIso: string, n: number): string {
  const [y, m, d] = weekStartIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n * 7);
  return mondayOf(dt);
}

export function formatWeekRange(weekStartIso: string): string {
  const [y, m, d] = weekStartIso.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
  return `${f(start)} – ${f(end)}`;
}

export function todayDayKey(d: Date = new Date()): DayKey {
  const map: DayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return map[d.getDay()];
}

/** Generate dropdown time options every 15min. */
export const TIME_OPTIONS: string[] = (() => {
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      arr.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return arr;
})();

/** Normalize a manually-typed time string to HH:MM (24h). Returns '' if invalid. */
export function normalizeTimeInput(raw: string): string {
  const s = raw
    .trim()
    .replace(/[hH.,]/g, ':')
    .replace(/\s+/g, '');
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  let hh = '';
  let mm = '';
  if (s.includes(':')) {
    const [a, b = ''] = s.split(':');
    hh = a.padStart(2, '0');
    mm = (b || '0').padStart(2, '0');
  } else if (digits.length <= 2) {
    hh = digits.padStart(2, '0');
    mm = '00';
  } else if (digits.length === 3) {
    hh = digits.slice(0, 1).padStart(2, '0');
    mm = digits.slice(1);
  } else {
    hh = digits.slice(0, 2);
    mm = digits.slice(2, 4);
  }
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
