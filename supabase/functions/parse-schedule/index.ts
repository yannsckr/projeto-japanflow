import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type DayKey = (typeof DAY_KEYS)[number];
type DaySchedule = { entry: string; exit: string };
type WeekDays = Record<DayKey, DaySchedule>;
type ParsedWeek = { weekStart?: string; days: WeekDays };

const emptyDays = (): WeekDays =>
  DAY_KEYS.reduce((acc, day) => {
    acc[day] = { entry: '', exit: '' };
    return acc;
  }, {} as WeekDays);

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizeTime = (hour: string, minute: string) =>
  `${String(Number(hour)).padStart(2, '0')}:${minute.padStart(2, '0')}`;

const hasWork = (days: WeekDays) =>
  DAY_KEYS.some((day) => Boolean(days[day]?.entry && days[day]?.exit));

const isoDate = (year: number, month: number, day: number) => {
  const d = new Date(year, month - 1, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

const mondayOfIso = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const referenceYearFrom = (referenceWeekStart?: string) => {
  const year = Number(referenceWeekStart?.slice(0, 4));
  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
};

const resolveYear = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed < 100 ? 2000 + parsed : parsed;
};

const extractDateRangeWeekStart = (line: string, referenceWeekStart?: string) => {
  const normalized = normalizeText(line);
  const match = normalized.match(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:a|as|ate|à|-|–|—)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/
  );
  if (!match) return undefined;

  const fallbackYear = referenceYearFrom(referenceWeekStart);
  const year = resolveYear(match[3], fallbackYear);
  const startIso = isoDate(year, Number(match[2]), Number(match[1]));
  return mondayOfIso(startIso);
};

const DATE_RANGE_REGEX =
  /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*(?:a|as|ate|à|-|–|—)\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/gi;

const extractTimeRanges = (line: string) => {
  const normalized = normalizeText(line);
  const ranges: Array<{ entry: string; exit: string; index: number }> = [];
  const regex =
    /(\d{1,2})\s*(?:[:h])\s*(\d{2})\s*(?:a|as|ate|-|–|—)\s*(\d{1,2})\s*(?:[:h])\s*(\d{2})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized))) {
    ranges.push({
      entry: normalizeTime(match[1], match[2]),
      exit: normalizeTime(match[3], match[4]),
      index: match.index,
    });
  }
  return ranges.filter((range) => {
    const context = normalized.slice(Math.max(0, range.index - 35), range.index + 55);
    return !context.includes('almoco');
  });
};

const splitScheduleRecords = (sources: string[], referenceWeekStart?: string) => {
  const rawLines = sources
    .flatMap((source) => source.split(/\r?\n/))
    .flatMap((line) => line.split(/\\n|\}\s*,\s*\{|"\s*,\s*"/))
    .map((line) => line.trim())
    .filter(Boolean);

  const records: string[] = [];
  let current = '';

  for (const line of rawLines) {
    const hasDate = Boolean(extractDateRangeWeekStart(line, referenceWeekStart));
    const hasTime = extractTimeRanges(line).length > 0;

    if (!current) {
      current = line;
    } else {
      current = `${current} | ${line}`;
    }

    if (hasDate && (hasTime || extractTimeRanges(current).length > 0)) {
      records.push(current);
      current = '';
    }
  }

  if (current && extractDateRangeWeekStart(current, referenceWeekStart) && extractTimeRanges(current).length) {
    records.push(current);
  }

  const joined = rawLines.join(' | ');
  const normalizedJoined = normalizeText(joined);
  const matches = [...normalizedJoined.matchAll(DATE_RANGE_REGEX)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    const previousEnd = i > 0 ? (matches[i - 1].index ?? 0) + matches[i - 1][0].length : 0;
    const nextStart = matches[i + 1]?.index ?? normalizedJoined.length;

    // Schedules exported from spreadsheets commonly put the week range as the
    // last cell of each row. Keep the text after the previous date up to this
    // date so the first week (ex: 06/07 a 12/07) is not swallowed by the next row.
    const rowEndingAtDate = joined.slice(Math.max(0, previousEnd), Math.min(joined.length, matchEnd + 30));
    if (extractTimeRanges(rowEndingAtDate).length) records.push(rowEndingAtDate);

    // Also support layouts where the date appears before the hours, but only
    // when the hours are close after the date. This avoids mixing the current
    // week date with the next spreadsheet row's schedule.
    const afterDateWindow = joined.slice(matchEnd, Math.min(joined.length, nextStart, matchEnd + 180));
    if (extractTimeRanges(afterDateWindow).length) {
      records.push(joined.slice(Math.max(0, matchStart - 30), Math.min(joined.length, matchEnd + 180)));
    }
  }

  return [...new Set(records)];
};

const isLunchOnlyNote = (line: string) => {
  const normalized = normalizeText(line);
  return (
    normalized.includes('almoco') &&
    !extractDateRangeWeekStart(line) &&
    !/(?:segunda|seg|terca|ter|quarta|qua|quinta|qui|sexta|sex|sabado|sab|domingo|dom)/.test(
      normalized
    )
  );
};

const applySchedule = (
  days: WeekDays,
  dayKeys: DayKey[],
  range?: { entry: string; exit: string }
) => {
  if (!range) return;
  for (const day of dayKeys) {
    days[day] = { entry: range.entry, exit: range.exit };
  }
};

const parseScheduleRows = (sources: string[], referenceWeekStart?: string): ParsedWeek[] => {
  const byWeek = new Map<string, WeekDays>();

  const records = splitScheduleRecords(sources, referenceWeekStart).sort((a, b) => {
    const dateA = extractDateRangeWeekStart(a, referenceWeekStart) ? 0 : 1;
    const dateB = extractDateRangeWeekStart(b, referenceWeekStart) ? 0 : 1;
    const lenA = a.length;
    const lenB = b.length;
    return dateA - dateB || lenA - lenB;
  });

  for (const line of records) {
    if (isLunchOnlyNote(line)) continue;
    const weekStart = extractDateRangeWeekStart(line, referenceWeekStart);
    if (!weekStart) continue;

    const normalized = normalizeText(line);

    const ranges = extractTimeRanges(line);
    if (!ranges.length) continue;

    if (byWeek.has(weekStart)) continue;

    const days = emptyDays();
    const firstRange = ranges[0];
    const secondRange = ranges[1];
    const hasMondayToFriday = /(?:segunda|seg)\s*a\s*(?:sexta|sex)/.test(normalized);
    const hasMondayToThursday = /(?:segunda|seg)\s*a\s*(?:quinta|qui)/.test(normalized);
    const hasWeekdaySchedule =
      hasMondayToFriday ||
      hasMondayToThursday ||
      /(?:segunda|seg).*?(?:sexta|sex)/.test(normalized) ||
      /(?:segunda|seg).*?(?:quinta|qui)/.test(normalized);
    const mentionsFriday = /\b(?:sexta|sex)\b/.test(normalized);
    const mentionsSaturday = /\b(?:sabado|sab)\b/.test(normalized);
    const saturdayOff =
      /folga\s*(?:no|na)?\s*sabado/.test(normalized) || /sabado\s*[:-]?\s*folga/.test(normalized);

    if (hasMondayToThursday || /(?:segunda|seg).*?(?:quinta|qui)/.test(normalized)) {
      applySchedule(days, ['monday', 'tuesday', 'wednesday', 'thursday'], firstRange);
      if (mentionsFriday && secondRange) applySchedule(days, ['friday'], secondRange);
    } else if (hasMondayToFriday || /(?:segunda|seg).*?(?:sexta|sex)/.test(normalized)) {
      applySchedule(days, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], firstRange);
    } else if (ranges.length && !mentionsSaturday) {
      applySchedule(days, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], firstRange);
    }

    if (mentionsSaturday && !saturdayOff) {
      const saturdayRange = hasMondayToThursday
        ? ranges[2]
        : hasMondayToFriday || hasWeekdaySchedule
          ? secondRange
          : firstRange;
      applySchedule(days, ['saturday'], saturdayRange);
    }

    if (hasWork(days)) byWeek.set(weekStart, days);
  }

  return [...byWeek.entries()]
    .map(([weekStart, days]) => ({ weekStart, days }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
};

const normalizeAiWeeks = (
  weeks: Array<{ weekStart?: string; days?: Record<string, { entry?: string; exit?: string }> }> = []
): ParsedWeek[] =>
  weeks.map((week) => {
    const days = emptyDays();
    for (const day of DAY_KEYS) {
      const value = week.days?.[day];
      days[day] = { entry: value?.entry || '', exit: value?.exit || '' };
    }
    return { weekStart: week.weekStart, days };
  });

const mergeValidatedWeeks = (aiWeeks: ParsedWeek[], rowWeeks: ParsedWeek[]) => {
  if (!rowWeeks.length) return aiWeeks;
  const rowWeekStarts = new Set(rowWeeks.map((week) => week.weekStart).filter(Boolean));
  const merged = [
    ...rowWeeks,
    ...aiWeeks.filter((week) => !week.weekStart || !rowWeekStarts.has(week.weekStart)),
  ];
  return merged.sort((a, b) => (a.weekStart || '').localeCompare(b.weekStart || ''));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageBase64, mimeType, text, userName, referenceWeekStart } = await req.json();
    if (!imageBase64 && !text) {
      return new Response(JSON.stringify({ error: 'imageBase64 ou text obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Você analisa escalas de trabalho (uma ou várias semanas).
${userName ? `Usuário alvo: ${userName}. Extraia APENAS a escala desse usuário.` : ''}
${referenceWeekStart ? `Semana de referência selecionada (segunda-feira): ${referenceWeekStart}. Se a escala não indicar datas, use essa semana.` : ''}

Os dias são: monday, tuesday, wednesday, thursday, friday, saturday, sunday.
Para cada dia, extraia APENAS entrada e saída (HH:MM, 24h). Considere que existe um intervalo fixo de almoço de 1 hora — NÃO retorne 2 turnos, retorne só "entry" e "exit" englobando o dia todo.
Se for folga, deixe entry e exit como "".

A imagem/texto pode conter VÁRIAS semanas. Retorne um array "weeks", uma entrada por semana detectada. Inclua "weekStart" (data da segunda-feira no formato YYYY-MM-DD) quando conseguir identificar pelas datas/cabeçalhos. Se não houver datas explícitas, omita weekStart (apenas para a primeira/única semana).
Além de "weeks", retorne também "sourceRows" com cada linha da tabela transcrita exatamente como você leu, incluindo horários, texto do sábado e período da semana. Isso será usado para validação automática.

ATENÇÃO para tabelas com colunas parecidas com: "08:00 as 17:00 segunda a sexta", "Sábado", "Semana".
Exemplo obrigatório de interpretação:
- Linha "08:00 as 17:00 segunda a sexta | 08:00 as 12:00 | ... | 06/07 a 12/07" significa weekStart "YYYY-07-06", segunda a sexta 08:00-17:00 e sábado 08:00-12:00.
- Linha "08:00 as 18:00 seg a quinta || sexta 08:00 as 17:00 | FOLGA | ... | 13/07 a 18/07" significa segunda a quinta 08:00-18:00, sexta 08:00-17:00, sábado folga.
Nunca marque uma semana inteira como folga quando a mesma linha contém horários de segunda a sexta.

Responda SOMENTE com JSON puro, sem markdown:
{"sourceRows":["08:00 as 17:00 segunda a sexta | 08:00 as 12:00 | 44 horas | Plantão sábado | 06/07 a 12/07"],"weeks":[{"weekStart":"YYYY-MM-DD","days":{"monday":{"entry":"08:00","exit":"18:00"},"tuesday":{"entry":"08:00","exit":"18:00"},"wednesday":{"entry":"08:00","exit":"18:00"},"thursday":{"entry":"08:00","exit":"18:00"},"friday":{"entry":"08:00","exit":"18:00"},"saturday":{"entry":"08:00","exit":"12:00"},"sunday":{"entry":"","exit":""}}}]}`;

    const content: unknown[] = [{ type: 'text', text: prompt }];
    if (imageBase64) {
      const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
      content.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
    if (text) {
      content.push({ type: 'text', text: `\n\nTexto da escala:\n${text}` });
    }

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: 'IA falhou', detail: t }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed: {
      sourceRows?: string[];
      weeks?: Array<{
        weekStart?: string;
        days: Record<string, { entry?: string; exit?: string }>;
      }>;
      days?: Record<string, { entry?: string; exit?: string }>;
    } = {};
    try {
      const m = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : cleaned);
    } catch {
      parsed = {};
    }

    // Back-compat: if model returned `days` directly, wrap it.
    const aiWeeks = normalizeAiWeeks(parsed.weeks ?? (parsed.days ? [{ days: parsed.days }] : []));
    const deterministicWeeks = parseScheduleRows(
      [...(parsed.sourceRows || []), raw, text || ''],
      referenceWeekStart
    );
    const weeks = mergeValidatedWeeks(aiWeeks, deterministicWeeks);

    return new Response(JSON.stringify({ weeks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
