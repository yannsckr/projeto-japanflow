const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];
const emptyDays = () => Object.fromEntries(DAY_KEYS.map((day) => [day, { entry: '', exit: '' }]));
const normalizeText = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const normalizeTime = (hour, minute) =>
  `${String(Number(hour)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
const hasWork = (days) => DAY_KEYS.some((day) => Boolean(days[day]?.entry && days[day]?.exit));
function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10);
}
function mondayOfIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!match) return null;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}
function extractDateRangeWeekStart(line, referenceWeekStart) {
  const match = normalizeText(line).match(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:a|as|ate|à|-|–|—)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/
  );
  if (!match) return null;
  const fallbackYear = Number(referenceWeekStart?.slice(0, 4)) || new Date().getFullYear();
  const rawYear = match[3] ? Number(match[3]) : fallbackYear;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return mondayOfIso(isoDate(year, Number(match[2]), Number(match[1])));
}
function extractTimeRanges(line) {
  const normalized = normalizeText(line);
  const ranges = [];
  const regex =
    /(\d{1,2})\s*(?:[:h])\s*(\d{2})\s*(?:a|as|ate|-|–|—)\s*(\d{1,2})\s*(?:[:h])\s*(\d{2})/g;
  let match;
  while ((match = regex.exec(normalized))) {
    const entry = normalizeTime(match[1], match[2]);
    const exit = normalizeTime(match[3], match[4]);
    const context = normalized.slice(Math.max(0, match.index - 35), match.index + 55);
    if (!context.includes('almoco') && validTime(entry) && validTime(exit)) {
      ranges.push({ entry, exit });
    }
  }
  return ranges;
}
function applySchedule(days, dayKeys, range) {
  if (!range) return;
  for (const day of dayKeys) {
    days[day] = { entry: range.entry, exit: range.exit };
  }
}
function parseScheduleRows(sources, referenceWeekStart) {
  const byWeek = new Map();
  const lines = sources
    .filter((s) => typeof s === 'string')
    .flatMap((s) => s.split(/\r?\n/))
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    const weekStart = extractDateRangeWeekStart(line, referenceWeekStart);
    if (!weekStart || byWeek.has(weekStart)) continue;
    const normalized = normalizeText(line);
    const ranges = extractTimeRanges(line);
    if (!ranges.length) continue;
    const days = emptyDays();
    const first = ranges[0];
    const second = ranges[1];
    const mondayThursday = /(?:segunda|seg).*?(?:quinta|qui)/.test(normalized);
    const mondayFriday = /(?:segunda|seg).*?(?:sexta|sex)/.test(normalized);
    const friday = /\b(?:sexta|sex)\b/.test(normalized);
    const saturday = /\b(?:sabado|sab)\b/.test(normalized);
    const saturdayOff =
      /folga\s*(?:no|na)?\s*sabado/.test(normalized) || /sabado\s*[:-]?\s*folga/.test(normalized);
    if (mondayThursday) {
      applySchedule(days, ['monday', 'tuesday', 'wednesday', 'thursday'], first);
      if (friday && second) applySchedule(days, ['friday'], second);
    } else if (mondayFriday) {
      applySchedule(days, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], first);
    } else if (!saturday) {
      applySchedule(days, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], first);
    }
    if (saturday && !saturdayOff) {
      applySchedule(days, ['saturday'], mondayThursday ? ranges[2] : second || first);
    }
    if (hasWork(days)) byWeek.set(weekStart, days);
  }
  return [...byWeek.entries()].map(([weekStart, days]) => ({ weekStart, days }));
}
function cleanJsonText(value) {
  const cleaned = String(value || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  return cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
}
function normalizeWeeks(parsed) {
  if (!Array.isArray(parsed?.weeks)) return [];
  return parsed.weeks.flatMap((week) => {
    const weekStart = mondayOfIso(week?.weekStart);
    if (!weekStart) return [];
    const days = emptyDays();
    for (const day of DAY_KEYS) {
      const entry = String(week?.days?.[day]?.entry || '').trim();
      const exit = String(week?.days?.[day]?.exit || '').trim();
      if (validTime(entry) && validTime(exit)) days[day] = { entry, exit };
    }
    return [{ weekStart, days }];
  });
}
async function generateSchedule(prompt, image) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const models = [...new Set([process.env.GEMINI_MODEL, ...MODELS].filter(Boolean))];
  let lastError = 'Gemini indisponível';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parts = [{ text: prompt }];
        if (image) parts.push({ inlineData: image });
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key,
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
            }),
            signal: AbortSignal.timeout(30000),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const text = (data.candidates?.[0]?.content?.parts || [])
            .map((part) => part.text || '')
            .join('\n')
            .trim();
          if (!text) throw new Error('Resposta vazia do Gemini');
          return { text, model };
        }
        lastError = `Gemini HTTP ${response.status}`;
        console.error('schedule-ai', { model, status: response.status });
        if (![429, 503].includes(response.status)) break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error('schedule-ai', { model, error: lastError });
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw new Error(lastError);
}
export async function handleScheduleAi(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  if (!text && !imageBase64) {
    return { status: 400, body: { error: 'imageBase64 ou text obrigatório' } };
  }
  if (text.length > 12000 || imageBase64.length > 15000000) {
    return { status: 413, body: { error: 'Conteúdo muito grande' } };
  }
  let image;
  if (imageBase64) {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(imageBase64);
    const mimeType = match?.[1] || body.mimeType || 'image/jpeg';
    const data = match?.[2] || imageBase64;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data) ||
      data.length % 4 !== 0
    ) {
      return { status: 400, body: { error: 'Imagem inválida ou formato não suportado' } };
    }
    image = { mimeType, data };
  }
  const prompt = `Analise uma ou várias semanas de escala.
${body.userName ? `Usuário alvo: ${String(body.userName).slice(0, 120)}.` : ''}
${body.referenceWeekStart ? `Semana de referência: ${body.referenceWeekStart}.` : ''}
Retorne SOMENTE JSON:
{"sourceRows":["linha"],"weeks":[{"weekStart":"YYYY-MM-DD","days":{"monday":{"entry":"08:00","exit":"17:00"},"tuesday":{"entry":"","exit":""},"wednesday":{"entry":"","exit":""},"thursday":{"entry":"","exit":""},"friday":{"entry":"","exit":""},"saturday":{"entry":"","exit":""},"sunday":{"entry":"","exit":""}}}]}
Folga => entry/exit vazios. Não separe almoço em dois turnos.
${text ? `Texto:\n${text}` : ''}`;
  try {
    const result = await generateSchedule(prompt, image);
    const parsed = JSON.parse(cleanJsonText(result.text));
    const aiWeeks = normalizeWeeks(parsed);
    const sourceRows = Array.isArray(parsed.sourceRows)
      ? parsed.sourceRows.filter((row) => typeof row === 'string').slice(0, 100)
      : [];
    const deterministic = parseScheduleRows(
      [...sourceRows, result.text, text],
      body.referenceWeekStart
    );
    const deterministicStarts = new Set(deterministic.map((week) => week.weekStart));
    const weeks = [
      ...deterministic,
      ...aiWeeks.filter((week) => !deterministicStarts.has(week.weekStart)),
    ];
    return { status: 200, body: { weeks, meta: { model: result.model } } };
  } catch (error) {
    console.error('parse-schedule', error);
    return {
      status: 502,
      body: { error: 'IA falhou ao interpretar a escala.' },
    };
  }
}
