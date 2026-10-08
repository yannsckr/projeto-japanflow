const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash'];
function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function parseJson(raw) {
  const cleaned = String(raw)
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new SyntaxError('JSON não encontrado');
    return JSON.parse(match[0]);
  }
}
async function generate(prompt, system, jsonMode = true) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const models = [...new Set([process.env.GEMINI_MODEL, ...MODELS].filter(Boolean))];
  let lastError = 'Gemini indisponível';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${API_URL}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
            },
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (response.ok) {
          const data = await response.json();
          const text = (data.candidates?.[0]?.content?.parts || [])
            .map((part) => part.text || '')
            .join('\n')
            .trim();
          if (!text) throw new Error('Resposta vazia do Gemini');
          return { text, model };
        }
        lastError = `HTTP ${response.status}`;
        console.error('calendar-ai', { model, status: response.status });
        if (![429, 503].includes(response.status)) break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error('calendar-ai', { model, error: lastError });
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw new Error(lastError);
}
function normalize(parsed, today, users) {
  const userIds = new Set(users.map((user) => String(user?.id || '')).filter(Boolean));
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
  const items = (Array.isArray(parsed?.items) ? parsed.items : [])
    .map((item) => {
      if (item?.kind === 'task') {
        const assigneeId = item.assigneeId ? String(item.assigneeId) : null;
        return {
          kind: 'task',
          title: String(item.title || '').trim(),
          description: String(item.description || '').trim(),
          assigneeId: assigneeId && userIds.has(assigneeId) ? assigneeId : null,
          assigneeName: item.assigneeName ? String(item.assigneeName) : null,
          priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
          deadline: validDate(item.deadline) ? String(item.deadline) : null,
          time: validTime(item.time) ? String(item.time) : null,
        };
      }
      if (item?.kind !== 'calendar') return null;
      return {
        kind: 'calendar',
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        date: validDate(item.date) ? String(item.date) : today,
        time: validTime(item.time) ? String(item.time) : null,
        type: item.type === 'reminder' ? 'reminder' : 'event',
        targetMode: ['all', 'sector', 'specific'].includes(item.targetMode)
          ? item.targetMode
          : 'all',
        targetInfo: String(item.targetInfo || 'todos'),
      };
    })
    .filter((item) => item?.title);
  const events = items
    .filter((item) => item.kind === 'calendar')
    .map(({ kind: _kind, ...event }) => event);
  return { items, events };
}
export async function handleCalendarAi(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return { status: 400, body: { error: 'Texto é obrigatório' } };
  if (text.length > 5000) {
    return { status: 413, body: { error: 'Comando muito longo' } };
  }
  const users = Array.isArray(body.users) ? body.users.slice(0, 100) : [];
  const sectors = Array.isArray(body.sectors) ? body.sectors.slice(0, 50) : [];
  const today = todayInSaoPaulo();
  const system = `Você é o assistente operacional do ERP JapanFlow.
Hoje: ${today}. Fuso: America/Sao_Paulo.
Usuários disponíveis: ${JSON.stringify(users)}
Setores disponíveis: ${JSON.stringify(sectors)}
Interprete comandos em português. Existem três tipos de ação:
1. task: tarefas operacionais como separar pedidos, cobrar, entregar, conferir ou imprimir.
2. event: reuniões, visitas, compromissos e treinamentos.
3. reminder: lembrete quando o usuário pede explicitamente para lembrar ou avisar.
Uma frase pode gerar várias ações. Não transforme tarefa operacional em evento só por ter horário.
TASK:
- title: ação curta sem nome do responsável.
- description: detalhes operacionais, pedido, cliente, local e horário quando relevante.
- assigneeId: use somente IDs dos usuários disponíveis, nunca invente.
- assigneeName: nome identificado ou null.
- priority: high, medium ou low (padrão medium).
- deadline: YYYY-MM-DD somente com prazo explícito; caso contrário null.
- time: HH:mm somente com horário explícito; caso contrário null.
CALENDAR:
- date: YYYY-MM-DD, resolvendo datas relativas a partir de hoje.
- time: HH:mm ou null.
- type: event ou reminder.
- targetMode: all, sector ou specific.
- targetInfo: "todos", setor ou pessoas identificadas.
Exemplo: "separar pedido 123 para Ryan às 15h" é task, não event.
Retorne SOMENTE JSON válido:
{"items":[
{"kind":"task","title":"","description":"","assigneeId":null,"assigneeName":null,"priority":"medium","deadline":null,"time":null},
{"kind":"calendar","title":"","description":"","date":"YYYY-MM-DD","time":null,"type":"event","targetMode":"all","targetInfo":"todos"}
]}`;
  try {
    let response;
    try {
      response = await generate(text, system, true);
    } catch {
      response = await generate(text, system, false);
    }
    let parsed;
    try {
      parsed = parseJson(response.text);
    } catch {
      const repair = await generate(
        `Corrija este conteúdo para JSON válido sem inventar ações:\n${response.text}`,
        'Retorne somente um objeto JSON com a propriedade items, um array de tarefas e eventos.',
        true
      );
      parsed = parseJson(repair.text);
      response = repair;
    }
    return {
      status: 200,
      body: { ...normalize(parsed, today, users), meta: { model: response.model } },
    };
  } catch (error) {
    console.error('parse-calendar-events', error);
    return {
      status: 502,
      body: { error: 'Não foi possível interpretar o comando com a IA.' },
    };
  }
}
