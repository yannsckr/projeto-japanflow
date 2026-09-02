// Deadline calculation for Encomendas Balcão.
// Considers national holidays, SP state holidays, and São José dos Campos
// municipal holidays. Supports business-days (default) or hours-based prazo.

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Anonymous Gregorian algorithm for Easter Sunday
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function holidaysForYear(year: number): Set<string> {
  const set = new Set<string>();
  const easter = easterSunday(year);

  // Nacionais
  set.add(`${year}-01-01`); // Confraternização
  set.add(ymd(addDays(easter, -48))); // Carnaval (segunda)
  set.add(ymd(addDays(easter, -47))); // Carnaval (terça)
  set.add(ymd(addDays(easter, -2))); // Sexta-feira Santa
  set.add(`${year}-04-21`); // Tiradentes
  set.add(`${year}-05-01`); // Trabalho
  set.add(ymd(addDays(easter, 60))); // Corpus Christi
  set.add(`${year}-09-07`); // Independência
  set.add(`${year}-10-12`); // N. Sra. Aparecida
  set.add(`${year}-11-02`); // Finados
  set.add(`${year}-11-15`); // Proclamação da República
  set.add(`${year}-11-20`); // Consciência Negra (nacional desde 2024)
  set.add(`${year}-12-25`); // Natal

  // SP estadual
  set.add(`${year}-07-09`); // Revolução Constitucionalista

  // São José dos Campos (municipais)
  set.add(`${year}-03-19`); // São José (padroeiro)
  set.add(`${year}-07-27`); // Aniversário da cidade

  return set;
}

const holidayCache = new Map<number, Set<string>>();
function isHoliday(d: Date) {
  const y = d.getFullYear();
  if (!holidayCache.has(y)) holidayCache.set(y, holidaysForYear(y));
  return holidayCache.get(y)!.has(ymd(d));
}

function isBusinessDay(d: Date) {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6 && !isHoliday(d);
}

function addBusinessDays(start: Date, days: number) {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

/**
 * Parses the user-typed prazo string.
 * Returns either { hours } or { businessDays } or null.
 */
export function parsePrazo(
  s: string | null | undefined
): { hours: number } | { businessDays: number } | null {
  if (!s) return null;
  const txt = s.toLowerCase();
  const num = parseFloat(txt.replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0] || '');
  if (!isFinite(num) || num <= 0) return null;
  if (/\b(h|hr|hrs|hora|horas)\b/.test(txt) || /\d+\s*h(?!\w)/.test(txt)) {
    return { hours: num };
  }
  return { businessDays: Math.round(num) };
}

/**
 * Computes the predicted arrival date for a counter order.
 * - hours: add N hours to orderedAt; if orderedAt is between 11:00 and 13:30,
 *   add +1 extra hour (lunch buffer).
 * - business days: skip weekends + holidays (national, SP, SJC).
 */
export function computeArrival(
  orderedAt: string | null | undefined,
  prazoRaw: string | null | undefined
): Date | null {
  if (!orderedAt) return null;
  const parsed = parsePrazo(prazoRaw);
  if (!parsed) return null;
  const start = new Date(orderedAt);
  if ('hours' in parsed) {
    let h = parsed.hours;
    const mins = start.getHours() * 60 + start.getMinutes();
    if (mins >= 11 * 60 && mins < 13 * 60 + 30) h += 1;
    return new Date(start.getTime() + h * 3600 * 1000);
  }
  return addBusinessDays(start, parsed.businessDays);
}

export function fmtArrival(d: Date, withTime: boolean) {
  if (withTime) {
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('pt-BR');
}

export function arrivalLabel(
  orderedAt: string | null | undefined,
  prazoRaw: string | null | undefined
): string | null {
  const d = computeArrival(orderedAt, prazoRaw);
  if (!d) return null;
  const parsed = parsePrazo(prazoRaw);
  const withTime = !!parsed && 'hours' in parsed;
  return fmtArrival(d, withTime);
}
