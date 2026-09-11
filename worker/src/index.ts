interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
  ATTACHMENTS: R2Bucket;
}

const GEMINI_ATTEMPT_TIMEOUT_MS = 3500;
const ORIGIN_ADDRESS =
  'Avenida das Rosas, 111, Jardim Motorama, São José dos Campos, SP, 12224-000';

function corsHeaders(origin: string) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  };
}

function allowedOrigin(request: Request, env: Env): string {
  const configured = env.ALLOWED_ORIGIN?.trim() || '*';
  if (configured === '*') return '*';

  const requestOrigin = request.headers.get('Origin');
  const allowed = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!requestOrigin) return allowed[0] || 'null';
  return allowed.includes(requestOrigin) ? requestOrigin : 'null';
}

function json(request: Request, env: Env, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(allowedOrigin(request, env)),
  });
}

type FirebaseTokenPayload = {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  user_id?: string;
};

type AuthenticatedCaller = {
  uid: string;
  token: string;
  userId: string;
  role: 'admin' | 'employee';
};

let firebaseJwksCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}

async function getFirebaseJwks(): Promise<JsonWebKey[]> {
  if (firebaseJwksCache && firebaseJwksCache.expiresAt > Date.now()) {
    return firebaseJwksCache.keys;
  }

  const response = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!response.ok) throw new Error(`Firebase JWKS HTTP ${response.status}`);

  const data = (await response.json()) as { keys?: JsonWebKey[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (!keys.length) throw new Error('Firebase JWKS vazio');

  const cacheControl = response.headers.get('Cache-Control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  firebaseJwksCache = { expiresAt: Date.now() + Math.max(300, maxAge) * 1000, keys };
  return keys;
}

async function verifyFirebaseIdToken(token: string, env: Env): Promise<FirebaseTokenPayload> {
  if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID não configurado');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');

  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeJwtPart<FirebaseTokenPayload>(parts[1]);

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Cabeçalho JWT inválido');

  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || payload.exp <= now || payload.iat > now + 60)
    throw new Error('Token expirado');
  if (payload.aud !== env.FIREBASE_PROJECT_ID) throw new Error('Audience inválida');
  if (payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) {
    throw new Error('Issuer inválido');
  }

  const jwk = (await getFirebaseJwks()).find((key: any) => key.kid === header.kid);
  if (!jwk) throw new Error('Chave Firebase não encontrada');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    toArrayBuffer(base64UrlToBytes(parts[2])),
    toArrayBuffer(new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  );

  if (!verified) throw new Error('Assinatura JWT inválida');
  return payload;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function readAuthLink(
  env: Env,
  uid: string,
  idToken: string
): Promise<{ userId: string; role: 'admin' | 'employee'; active: boolean }> {
  if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID não configurado');

  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}` +
    `/databases/(default)/documents/auth_links/${encodeURIComponent(uid)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) throw new Error(`Vínculo de autenticação indisponível (${response.status})`);
  const document: any = await response.json();
  const fields = document?.fields || {};

  return {
    userId: String(fields.user_id?.stringValue || ''),
    role: fields.role?.stringValue === 'admin' ? 'admin' : 'employee',
    active: fields.active?.booleanValue !== false,
  };
}

async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthenticatedCaller | Response> {
  const token = bearerToken(request);
  if (!token) return json(request, env, { error: 'Não autenticado' }, 401);

  try {
    const payload = await verifyFirebaseIdToken(token, env);
    const link = await readAuthLink(env, payload.sub, token);

    if (!link.userId || !link.active) {
      return json(request, env, { error: 'Acesso desativado' }, 403);
    }

    return { uid: payload.sub, token, userId: link.userId, role: link.role };
  } catch (error) {
    console.warn('auth', error);
    return json(request, env, { error: 'Sessão inválida ou expirada' }, 401);
  }
}

function requireAdmin(request: Request, env: Env, caller: AuthenticatedCaller): Response | null {
  return caller.role === 'admin'
    ? null
    : json(request, env, { error: 'Acesso de administrador necessário' }, 403);
}

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '.');
}

function authEmailForUsername(username: string): string {
  return `${normalizeUsername(username)}@japanflow.local`;
}

function firestoreField(value: unknown): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number')
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreField) } };
  throw new Error('Valor Firestore não suportado');
}

async function adminCreateUser(
  request: Request,
  env: Env,
  caller: AuthenticatedCaller
): Promise<Response> {
  const denied = requireAdmin(request, env, caller);
  if (denied) return denied;
  if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) {
    return json(request, env, { error: 'Firebase não configurado no Worker' }, 500);
  }

  const body: any = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const username = normalizeUsername(String(body.username || ''));
  const password = String(body.password || '');
  const role = body.role === 'admin' ? 'admin' : 'employee';
  const sectors = Array.isArray(body.sectors)
    ? body.sectors.filter((value: unknown) => typeof value === 'string')
    : [];
  const userFunction = String(body.function || '').trim();

  if (!name || !username || password.length < 6) {
    return json(request, env, { error: 'Nome, usuário e senha válida são obrigatórios' }, 400);
  }

  const authEmail = authEmailForUsername(username);
  const signup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password, returnSecureToken: true }),
    }
  );

  const signupData: any = await signup.json().catch(() => ({}));
  if (!signup.ok || !signupData.localId) {
    const message =
      signupData?.error?.message === 'EMAIL_EXISTS'
        ? 'Usuário já existe'
        : 'Não foi possível criar a conta no Firebase Auth';
    return json(request, env, { error: message }, 400);
  }

  const authUid = String(signupData.localId);
  const prefix = role === 'admin' ? 'admin' : 'emp';
  const userId = `${prefix}-${Date.now()}`;
  const now = new Date().toISOString();
  const databaseRoot = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

  const userFields: Record<string, any> = {
    name: firestoreField(name),
    username: firestoreField(username),
    role: firestoreField(role),
    sectors: firestoreField(sectors),
    function: firestoreField(userFunction || null),
    avatar: firestoreField(null),
    backgroundColor: firestoreField(null),
    auth_uid: firestoreField(authUid),
    auth_email: firestoreField(authEmail),
    active: firestoreField(true),
    created_at: { timestampValue: now },
    updated_at: { timestampValue: now },
  };

  const linkFields: Record<string, any> = {
    user_id: firestoreField(userId),
    role: firestoreField(role),
    active: firestoreField(true),
    created_at: { timestampValue: now },
    updated_at: { timestampValue: now },
  };

  const commit = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:commit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${caller.token}`,
      },
      body: JSON.stringify({
        writes: [
          { update: { name: `${databaseRoot}/users/${userId}`, fields: userFields } },
          { update: { name: `${databaseRoot}/auth_links/${authUid}`, fields: linkFields } },
        ],
      }),
    }
  );

  if (!commit.ok) {
    console.error('admin-create-user Firestore', await commit.text());
    return json(
      request,
      env,
      {
        error:
          'Conta Auth criada, mas o perfil não pôde ser salvo. Não tente novamente sem revisar o Firebase Auth.',
      },
      500
    );
  }

  return json(request, env, {
    user: {
      id: userId,
      name,
      username,
      role,
      sectors,
      function: userFunction || undefined,
      authUid,
      authEmail,
      active: true,
    },
  });
}

function cleanJsonText(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function stripDataUrl(input: string, fallbackMime: string) {
  const match = input.match(/^data:([^;,]+);base64,(.+)$/s);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: fallbackMime, data: input };
}

async function callGemini(
  env: Env,
  model: string,
  prompt: string,
  inlineData?: { mimeType: string; data: string },
  systemInstruction?: string,
  jsonMode = false
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_ATTEMPT_TIMEOUT_MS);

  const parts: any[] = [{ text: prompt }];
  if (inlineData) parts.push({ inlineData });

  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          ...(systemInstruction
            ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
            : {}),
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function geminiText(
  env: Env,
  prompt: string,
  inlineData?: { mimeType: string; data: string },
  systemInstruction?: string,
  jsonMode = false
): Promise<{ text: string; model: string }> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const models = [
    ...new Set([
      env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]),
  ];

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastError = '';

  for (const model of models) {
    for (let attempt = 1; attempt <= 1; attempt += 1) {
      const response = await callGemini(
        env,
        model,
        prompt,
        inlineData,
        systemInstruction,
        jsonMode
      );

      if (response.ok) {
        const data: any = await response.json();

        const text = (data?.candidates?.[0]?.content?.parts || [])
          .map((part: any) => part?.text || '')
          .join('\n')
          .trim();

        if (!text) {
          console.warn(`Gemini ${model} respondeu sem texto`);
          lastError = `Modelo ${model} respondeu sem conteúdo`;
          break;
        }

        console.log(`Gemini OK: ${model} tentativa ${attempt}`);

        return {
          text,
          model,
        };
      }

      const responseText = await response.text();
      lastError = responseText;

      console.error(`Gemini ${model} HTTP ${response.status} tentativa ${attempt}`, responseText);

      const retryable =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      if (!retryable) {
        break;
      }
    }
  }

  throw new Error(lastError || 'Todos os modelos Gemini estão temporariamente indisponíveis');
}

/* CALENDAR + TASK AI */
async function parseCalendarEvents(request: Request, env: Env) {
  const body: any = await request.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json(request, env, { error: 'Texto é obrigatório' }, 400);

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const users = Array.isArray(body.users) ? body.users : [];
  const sectors = Array.isArray(body.sectors) ? body.sectors : [];

  const system = `Você é o assistente operacional do ERP JapanFlow.
Interprete comandos em português e transforme cada ação solicitada em um item estruturado.

Hoje: ${today}.
Usuários disponíveis: ${JSON.stringify(users)}
Setores disponíveis: ${JSON.stringify(sectors)}

Existem 3 tipos de item:
1. task: trabalho que alguém precisa executar. Exemplos: separar produto, conferir pedido, fazer entrega, imprimir documento, ligar para cliente, cobrar alguém, revisar algo.
2. event: compromisso/agendamento de calendário. Exemplos: reunião, visita, treinamento, compromisso em determinado horário.
3. reminder: lembrete de calendário, quando o usuário explicitamente pede para lembrar/avisar de algo.

REGRAS PARA TASK:
- title: ação curta e objetiva, sem o nome do funcionário e sem detalhes que pertencem à descrição.
- description: detalhes operacionais mencionados pelo usuário. Ex.: número do pedido, cliente, local, observações.
- assigneeId: use EXATAMENTE o id de um usuário disponível quando houver correspondência clara pelo nome. Nunca invente id.
- assigneeName: nome do funcionário identificado no comando.
- priority: high, medium ou low. Se não houver indicação, use medium.
- deadline: YYYY-MM-DD somente quando houver prazo/data explícita. Caso contrário null.
- time: HH:mm somente quando houver horário explícito. Caso contrário null. Se houver horário, inclua-o também de forma natural na description quando relevante.

REGRAS PARA EVENT/REMINDER:
- date: YYYY-MM-DD. Resolva "hoje", "amanhã", dias da semana e datas relativas usando a data de hoje acima.
- time: HH:mm ou null.
- type: event ou reminder.
- targetMode: all, sector ou specific.
- targetInfo: "todos", nome/label do setor, ou nome(s) das pessoas.

Se o comando contiver várias ações, retorne vários itens, inclusive misturando tarefas e calendário.
Não transforme uma tarefa operacional em evento só porque possui horário.
Exemplo: "criar entrega para motoboy Rafael na MHS às 15h" é TASK, não evento.
Exemplo: "separar produto pedido 123 para Ryan" é TASK com title "Separar produto" e description "Pedido número 123".

Retorne SOMENTE JSON válido neste formato:
{"items":[
  {"kind":"task","title":"","description":"","assigneeId":null,"assigneeName":null,"priority":"medium","deadline":null,"time":null},
  {"kind":"calendar","title":"","description":"","date":"YYYY-MM-DD","time":null,"type":"event","targetMode":"all","targetInfo":"todos"}
]}`;

  try {
    let raw = '';
    let model = '';

    try {
      const result = await geminiText(env, text, undefined, system, true);
      raw = result.text;
      model = result.model;
    } catch (error) {
      console.warn('parse-calendar-events json mode failed, retrying in normal mode', error);
      const result = await geminiText(env, text, undefined, system);
      raw = result.text;
      model = result.model;
    }

    const cleaned = cleanJsonText(raw);
    let parsed: any;

    try {
      parsed = JSON.parse(cleaned);
    } catch (firstParseError) {
      const extracted = cleaned.match(/\{[\s\S]*\}/)?.[0];

      if (extracted) {
        try {
          parsed = JSON.parse(extracted);
        } catch {
          parsed = undefined;
        }
      }

      if (!parsed) {
        console.warn('Gemini returned invalid JSON, attempting one repair pass', {
          model,
          preview: cleaned.slice(0, 500),
        });

        const repairSystem = `Converta o conteúdo recebido em JSON válido.
Não invente novas ações.
Não explique nada.
Retorne SOMENTE um objeto JSON no formato:
{"items":[
  {"kind":"task","title":"","description":"","assigneeId":null,"assigneeName":null,"priority":"medium","deadline":null,"time":null},
  {"kind":"calendar","title":"","description":"","date":"YYYY-MM-DD","time":null,"type":"event","targetMode":"all","targetInfo":"todos"}
]}`;

        const repaired = await geminiText(
          env,
          `Corrija este conteúdo para JSON válido:\n${cleaned}`,
          undefined,
          repairSystem,
          true
        );

        model = repaired.model;
        const repairedCleaned = cleanJsonText(repaired.text);
        parsed = JSON.parse(repairedCleaned.match(/\{[\s\S]*\}/)?.[0] || repairedCleaned || '{}');
      }
    }

    const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];

    const items = rawItems
      .map((item: any) => {
        if (item?.kind === 'task') {
          const priority = ['high', 'medium', 'low'].includes(item.priority)
            ? item.priority
            : 'medium';

          return {
            kind: 'task',
            title: String(item.title || '').trim(),
            description: String(item.description || '').trim(),
            assigneeId: item.assigneeId ? String(item.assigneeId) : null,
            assigneeName: item.assigneeName ? String(item.assigneeName) : null,
            priority,
            deadline: item.deadline ? String(item.deadline) : null,
            time: item.time ? String(item.time) : null,
          };
        }

        return {
          kind: 'calendar',
          title: String(item?.title || '').trim(),
          description: String(item?.description || '').trim(),
          date: String(item?.date || today),
          time: item?.time ? String(item.time) : null,
          type: item?.type === 'reminder' ? 'reminder' : 'event',
          targetMode: ['all', 'sector', 'specific'].includes(item?.targetMode)
            ? item.targetMode
            : 'all',
          targetInfo: String(item?.targetInfo || 'todos'),
        };
      })
      .filter((item: any) => item.title);

    // Mantém `events` por compatibilidade com qualquer consumidor antigo.
    const events = items
      .filter((item: any) => item.kind === 'calendar')
      .map(({ kind: _kind, ...event }: any) => event);

    return json(request, env, {
      items,
      events,
      meta: { model },
    });
  } catch (e) {
    console.error('parse-calendar-events', e);
    const detail =
      e instanceof SyntaxError
        ? 'A IA devolveu uma resposta inválida. Tente novamente.'
        : 'Não foi possível interpretar o comando com a IA.';
    return json(request, env, { error: detail }, 502);
  }
}

/* INVENTORY LABEL */
async function parseInventoryLabel(request: Request, env: Env) {
  const body: any = await request.json().catch(() => ({}));
  if (!body.imageBase64) return json(request, env, { error: 'imageBase64 obrigatório' }, 400);

  const image = stripDataUrl(body.imageBase64, body.mimeType || 'image/jpeg');
  const prompt = `Você analisa etiquetas de peças automotivas da JAPAN.
Extraia:
- type: PRIMEIRAS DUAS PALAVRAS da descrição;
- code: número abaixo do código de barras, sem zeros à esquerda.
Ignore L: e F:.
Responda SOMENTE JSON: {"type":"...","code":"..."}`;

  try {
    const { text: raw, model } = await geminiText(env, prompt, image);
    const parsed = JSON.parse(cleanJsonText(raw).match(/\{[\s\S]*\}/)?.[0] || '{}');
    return json(request, env, {
      type: String(parsed.type || '')
        .trim()
        .toUpperCase(),
      code: String(parsed.code || '')
        .trim()
        .replace(/^0+/, ''),
      meta: { model },
    });
  } catch (e) {
    console.error('parse-inventory-label', e);
    return json(request, env, { error: 'IA falhou ao ler a etiqueta.' }, 502);
  }
}

/* PURCHASE ORDER */
async function parsePurchaseOrder(request: Request, env: Env) {
  const body: any = await request.json().catch(() => ({}));
  if (!body.fileBase64) return json(request, env, { error: 'fileBase64 is required' }, 400);

  const file = stripDataUrl(body.fileBase64, body.mimeType || 'image/png');
  const system = `Extraia pedido/orçamento/nota e responda SOMENTE JSON:
{
  "supplier":{"razaoSocial":"","cnpj":"","celular":"","endereco":"","cep":"","municipioUf":"","email":"","contato":"","obs":""},
  "items":[{"nome":"","valor":0,"quantidade":1,"marca":"","aplicacao":"","codigo":""}]
}
codigo = Cód. Fabricante/Part Number, nunca código interno.
marca = Fabricante; nome = Descrição; valor = V. Custo Unit.; quantidade = Qtd. Compra.
valor e quantidade numéricos.`;

  try {
    const { text: raw, model } = await geminiText(
      env,
      'Extraia fornecedor e itens deste documento.',
      file,
      system
    );
    const parsed = JSON.parse(cleanJsonText(raw).match(/\{[\s\S]*\}/)?.[0] || '{}');
    return json(request, env, { ...parsed, meta: { model } });
  } catch (e) {
    console.error('parse-purchase-order', e);
    return json(request, env, { error: 'Não foi possível interpretar o documento.' }, 502);
  }
}

/* TRANSCRIBE IMAGE */
async function transcribeImage(request: Request, env: Env) {
  const body: any = await request.json().catch(() => ({}));
  if (!body.imageBase64) return json(request, env, { error: 'imageBase64 is required' }, 400);

  const image = stripDataUrl(body.imageBase64, body.mimeType || 'image/jpeg');
  const system = `Extraia APENAS:
Nome / Razão Social
CPF / CNPJ
CEP
Tipo de Logradouro
Nome do Logradouro
Número
Complemento
Bairro
UF
Município
Formato: "Campo: valor", um por linha.
Omita campos ausentes. Se nenhum existir: "Nenhum dado de envio encontrado na imagem."`;

  try {
    const { text, model } = await geminiText(env, 'Extraia os dados de envio.', image, system);
    return json(request, env, { text: text || 'Nenhum texto encontrado.', meta: { model } });
  } catch (e) {
    console.error('transcribe-image', e);
    return json(request, env, { error: 'Erro no serviço de IA' }, 502);
  }
}

/* PARSE SCHEDULE - deterministic validation preserved */
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const mondayOfIso = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const extractDateRangeWeekStart = (line: string, referenceWeekStart?: string) => {
  const normalized = normalizeText(line);
  const match = normalized.match(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:a|as|ate|à|-|–|—)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/
  );
  if (!match) return undefined;
  const fallbackYear = Number(referenceWeekStart?.slice(0, 4)) || new Date().getFullYear();
  const rawYear = match[3] ? Number(match[3]) : fallbackYear;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return mondayOfIso(isoDate(year, Number(match[2]), Number(match[1])));
};

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

const applySchedule = (
  days: WeekDays,
  dayKeys: DayKey[],
  range?: { entry: string; exit: string }
) => {
  if (!range) return;
  for (const day of dayKeys) days[day] = { entry: range.entry, exit: range.exit };
};

const parseScheduleRows = (sources: string[], referenceWeekStart?: string): ParsedWeek[] => {
  const byWeek = new Map<string, WeekDays>();
  const lines = sources
    .flatMap((s) => s.split(/\r?\n/))
    .map((x) => x.trim())
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
};

async function parseSchedule(request: Request, env: Env) {
  const body: any = await request.json().catch(() => ({}));
  if (!body.imageBase64 && !body.text) {
    return json(request, env, { error: 'imageBase64 ou text obrigatório' }, 400);
  }

  const prompt = `Analise uma ou várias semanas de escala.
${body.userName ? `Usuário alvo: ${body.userName}.` : ''}
${body.referenceWeekStart ? `Semana de referência: ${body.referenceWeekStart}.` : ''}
Retorne SOMENTE JSON:
{"sourceRows":["linha"],"weeks":[{"weekStart":"YYYY-MM-DD","days":{"monday":{"entry":"08:00","exit":"17:00"},"tuesday":{"entry":"","exit":""},"wednesday":{"entry":"","exit":""},"thursday":{"entry":"","exit":""},"friday":{"entry":"","exit":""},"saturday":{"entry":"","exit":""},"sunday":{"entry":"","exit":""}}}]}
Folga => entry/exit vazios. Não separe almoço em dois turnos.
${body.text ? `Texto:\n${body.text}` : ''}`;

  const image = body.imageBase64
    ? stripDataUrl(body.imageBase64, body.mimeType || 'image/jpeg')
    : undefined;

  try {
    const { text: raw, model } = await geminiText(env, prompt, image);
    const parsed = JSON.parse(cleanJsonText(raw).match(/\{[\s\S]*\}/)?.[0] || '{}');

    const aiWeeks: ParsedWeek[] = Array.isArray(parsed.weeks)
      ? parsed.weeks.map((week: any) => {
          const days = emptyDays();
          for (const day of DAY_KEYS) {
            days[day] = {
              entry: week?.days?.[day]?.entry || '',
              exit: week?.days?.[day]?.exit || '',
            };
          }
          return { weekStart: week.weekStart, days };
        })
      : [];

    const deterministic = parseScheduleRows(
      [...(parsed.sourceRows || []), raw, body.text || ''],
      body.referenceWeekStart
    );

    const deterministicStarts = new Set(deterministic.map((w) => w.weekStart));
    const weeks = [
      ...deterministic,
      ...aiWeeks.filter((w) => !w.weekStart || !deterministicStarts.has(w.weekStart)),
    ];

    return json(request, env, { weeks, meta: { model } });
  } catch (e) {
    console.error('parse-schedule', e);
    return json(request, env, { error: 'IA falhou ao interpretar a escala.' }, 502);
  }
}

/* FREIGHT */
const normalizeCity = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ALIASES: Record<string, string> = {
  'ilha bela': 'ilhabela',
  'sao bernardo': 'sao bernardo do campo',
};

const STATE_NAMES: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

type GeoPoint = {
  city: string | null;
  state: string | null;
  formatted: string;
  lat: number;
  lon: number;
};

function pickAddressPart(address: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = address?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function parseCityStateFromInput(address: string): {
  city: string | null;
  state: string | null;
} {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return { city: null, state: null };
  }

  const rawState = parts[parts.length - 1].toUpperCase();
  const state = STATE_NAMES[rawState] || parts[parts.length - 1];

  // Em "Centro, São José dos Campos, SP", a cidade é o penúltimo item.
  // Em "São José dos Campos, SP", idem.
  const city = parts[parts.length - 2] || null;

  return { city, state };
}

async function searchNominatimFreeText(query: string): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'br',
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      'User-Agent': 'JapanFlow/1.0',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}: ${await res.text()}`);
  }

  const data: any[] = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const r = data[0];
  const a = r.address || {};
  const lat = Number(r.lat);
  const lon = Number(r.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    city: pickAddressPart(a, [
      'city',
      'municipality',
      'town',
      'village',
      'county',
      'city_district',
    ]),
    state: pickAddressPart(a, ['state', 'region']),
    formatted: String(r.display_name || query),
    lat,
    lon,
  };
}

async function searchNominatimStructured(
  city: string,
  state: string | null
): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    city,
    country: 'Brasil',
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'br',
  });

  if (state) params.set('state', state);

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      'User-Agent': 'JapanFlow/1.0',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim structured HTTP ${res.status}: ${await res.text()}`);
  }

  const data: any[] = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const r = data[0];
  const a = r.address || {};
  const lat = Number(r.lat);
  const lon = Number(r.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    city:
      pickAddressPart(a, ['city', 'municipality', 'town', 'village', 'county', 'city_district']) ||
      city,
    state: pickAddressPart(a, ['state', 'region']) || state,
    formatted: String(r.display_name || `${city}, ${state || ''}, Brasil`),
    lat,
    lon,
  };
}

async function geocode(address: string): Promise<GeoPoint | null> {
  const parsed = parseCityStateFromInput(address);
  const stateName =
    parsed.state && STATE_NAMES[parsed.state.toUpperCase()]
      ? STATE_NAMES[parsed.state.toUpperCase()]
      : parsed.state;

  const candidates = [
    address.trim(),
    `${address.trim()}, Brasil`,
    parsed.city && stateName ? `${parsed.city}, ${stateName}, Brasil` : '',
    parsed.city ? `${parsed.city}, Brasil` : '',
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    try {
      const found = await searchNominatimFreeText(candidate);
      if (found) {
        if (!found.city && parsed.city) found.city = parsed.city;
        if (!found.state && stateName) found.state = stateName;
        console.log(`Nominatim free-text match: ${candidate}`);
        return found;
      }
    } catch (error) {
      console.error(`Nominatim free-text failed for "${candidate}"`, error);
    }
  }

  if (parsed.city) {
    try {
      const found = await searchNominatimStructured(parsed.city, stateName);
      if (found) {
        console.log(`Nominatim structured match: city=${parsed.city}, state=${stateName || ''}`);
        return found;
      }
    } catch (error) {
      console.error('Nominatim structured failed', error);
    }
  }

  return null;
}

async function routeDistanceKm(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): Promise<number> {
  const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;

  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`,
    {
      headers: {
        'User-Agent': 'JapanFlow/1.0',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`OSRM HTTP ${res.status}: ${await res.text()}`);
  }

  const data: any = await res.json();
  const meters = data?.routes?.[0]?.distance;

  if (!Number.isFinite(Number(meters))) {
    throw new Error('Sem rota disponível');
  }

  return Number(meters) / 1000;
}

let originGeoCache: GeoPoint | null = null;

async function getOriginGeo(): Promise<GeoPoint> {
  if (originGeoCache) return originGeoCache;

  const geo = await geocode(ORIGIN_ADDRESS);
  if (!geo) {
    throw new Error('Não foi possível localizar o endereço de origem');
  }

  originGeoCache = geo;
  return geo;
}

async function computeRoundTripKm(destination: GeoPoint): Promise<number> {
  const origin = await getOriginGeo();
  const oneWayKm = await routeDistanceKm(origin, destination);

  // Ida + volta aproximada com uma única chamada ao OSRM.
  return oneWayKm * 2;
}

function firestoreValueToJs(value: any): any {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  return null;
}

async function getFreightDestination(env: Env, slug: string, idToken: string): Promise<any | null> {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_API_KEY) {
    throw new Error('FIREBASE_PROJECT_ID/FIREBASE_API_KEY não configurados.');
  }

  const documentId = slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

  const base =
    `https://firestore.googleapis.com/v1/projects/` +
    `${encodeURIComponent(env.FIREBASE_PROJECT_ID)}` +
    `/databases/(default)/documents/freight_destinations/`;

  const url =
    `${base}${encodeURIComponent(documentId)}` + `?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (response.status === 404) {
    console.log(`Freight destination não encontrado: ${documentId}`);
    return null;
  }

  if (!response.ok) {
    throw new Error(`Firestore HTTP ${response.status}: ${await response.text()}`);
  }

  const document: any = await response.json();
  const fields = document?.fields;

  if (!fields) return null;

  const out: any = {};

  for (const [key, value] of Object.entries(fields)) {
    out[key] = firestoreValueToJs(value);
  }

  return out;
}

async function freightCalc(request: Request, env: Env) {
  const body: any = await request.json().catch(() => ({}));
  const idToken = bearerToken(request);
  if (!idToken) return json(request, env, { error: 'Não autenticado' }, 401);
  const address = typeof body.address === 'string' ? body.address.trim() : '';

  if (address.length < 5) {
    return json(request, env, { error: 'Endereço inválido' }, 400);
  }

  try {
    const parsed = parseCityStateFromInput(address);
    const geo = await geocode(address);

    if (!geo) {
      // Fallback funcional:
      // se não houver geocodificação, ainda tenta a tabela de frete pela cidade
      // extraída do texto. Isso mantém fretes de valor fixo funcionando.
      if (!parsed.city) {
        return json(
          request,
          env,
          { error: 'Não foi possível identificar a cidade do endereço' },
          404
        );
      }

      const rawSlug = normalizeCity(parsed.city);
      const slug = ALIASES[rawSlug] || rawSlug;
      const dest = await getFreightDestination(env, slug, idToken);

      if (!dest) {
        return json(request, env, {
          city: parsed.city,
          state: parsed.state,
          carrier: 'Transportadora',
          price: '—',
          deadline: '—',
          notes: 'Cidade não atendida por entrega expressa. Consultar fretes disponíveis no site.',
          resolvedAddress: address,
          provider: 'input-fallback',
        });
      }

      if (dest.per_km_rate != null) {
        return json(
          request,
          env,
          {
            error:
              'A cidade foi identificada, mas não foi possível calcular a distância para o frete por km.',
            city: parsed.city,
            state: parsed.state,
          },
          502
        );
      }

      return json(request, env, {
        city: parsed.city,
        state: parsed.state,
        carrier: dest.carrier || '',
        price: dest.price || '',
        deadline: dest.deadline || '',
        notes: dest.notes || undefined,
        resolvedAddress: address,
        provider: 'input-fallback',
      });
    }

    const rawSlug = normalizeCity(geo.city || parsed.city || '');
    const slug = ALIASES[rawSlug] || rawSlug;
    const dest = await getFreightDestination(env, slug, idToken);

    let result: any = {
      city: geo.city || parsed.city,
      state: geo.state || parsed.state,
      carrier: '',
      price: '',
      deadline: '',
    };

    if (!dest) {
      result = {
        ...result,
        carrier: 'Transportadora',
        price: '—',
        deadline: '—',
        notes: 'Cidade não atendida por entrega expressa. Consultar fretes disponíveis no site.',
      };
    } else if (dest.per_km_rate != null) {
      const km = await computeRoundTripKm(geo);
      const rate = Number(dest.per_km_rate);
      const price = Math.ceil(km * rate);

      result = {
        ...result,
        carrier: dest.carrier || 'Motoboy particular Japan Imports',
        price: `R$ ${price.toFixed(2).replace('.', ',')}`,
        deadline: dest.deadline || 'Mesmo dia (sujeito à disponibilidade)',
        notes:
          `${dest.notes ? `${dest.notes}. ` : ''}` +
          `Distância estimada: ${km.toFixed(2)} km (ida + volta), taxa R$ ${rate
            .toFixed(2)
            .replace('.', ',')} / km`,
        distanceKm: Math.round(km * 100) / 100,
      };
    } else {
      result = {
        ...result,
        carrier: dest.carrier || '',
        price: dest.price || '',
        deadline: dest.deadline || '',
        notes: dest.notes || undefined,
      };
    }

    return json(request, env, {
      ...result,
      resolvedAddress: geo.formatted,
      provider: 'openstreetmap-osrm',
    });
  } catch (e) {
    console.error('freight-calc', e);

    return json(request, env, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

/* R2 STORAGE */
type StorageObjectInfo = {
  path: string;
  size: number;
  mimetype: string | null;
  uploaded: string | null;
};

function normalizeStoragePath(input: string): string | null {
  let path = input.trim().replace(/^\/+/, '');

  try {
    path = decodeURIComponent(path);
  } catch {
    // Mantém o path original se houver escape inválido.
  }

  if (!path || path.includes('')) return null;
  if (!path.startsWith('attachments/')) return null;

  return path;
}

function storageFileUrl(request: Request, path: string): string {
  const origin = new URL(request.url).origin;
  const encoded = path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${origin}/storage/file/${encoded}`;
}

async function putStorageFile(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = normalizeStoragePath(url.searchParams.get('path') || '');

  if (!path) {
    return json(
      request,
      env,
      { error: 'Path inválido. O arquivo deve ficar dentro de attachments/.' },
      400
    );
  }

  if (!request.body) {
    return json(request, env, { error: 'Arquivo vazio' }, 400);
  }

  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

  const customMetadata: Record<string, string> = {
    sourceTable: url.searchParams.get('sourceTable') || '',
    sourceId: url.searchParams.get('sourceId') || '',
    sourceField: url.searchParams.get('sourceField') || '',
    uploadedBy: url.searchParams.get('uploadedBy') || '',
    preserve: url.searchParams.get('preserve') === 'true' ? 'true' : 'false',
  };

  try {
    const bytes = await request.arrayBuffer();

    await env.ATTACHMENTS.put(path, bytes, {
      httpMetadata: { contentType },
      customMetadata,
    });

    const object = await env.ATTACHMENTS.head(path);

    return json(request, env, {
      ok: true,
      storagePath: path,
      publicUrl: storageFileUrl(request, path),
      sizeBytes: object?.size ?? null,
      mimeType: object?.httpMetadata?.contentType || contentType,
    });
  } catch (error) {
    console.error('storage-upload', error);
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
}

async function getStorageFile(
  request: Request,
  env: Env,
  pathInput: string,
  headOnly = false
): Promise<Response> {
  const path = normalizeStoragePath(pathInput);

  if (!path) {
    return json(request, env, { error: 'Path inválido' }, 400);
  }

  try {
    const object = headOnly ? await env.ATTACHMENTS.head(path) : await env.ATTACHMENTS.get(path);

    if (!object) {
      return json(request, env, { error: 'Arquivo não encontrado' }, 404);
    }

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', allowedOrigin(request, env));
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('ETag', object.httpEtag);

    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType);
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }

    if (object.httpMetadata?.contentDisposition) {
      headers.set('Content-Disposition', object.httpMetadata.contentDisposition);
    }

    if (headOnly) {
      headers.set('Content-Length', String(object.size));
      return new Response(null, { status: 200, headers });
    }

    return new Response((object as R2ObjectBody).body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('storage-file', error);
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
}

async function deleteStorageFile(request: Request, env: Env, pathInput: string): Promise<Response> {
  const path = normalizeStoragePath(pathInput);

  if (!path) {
    return json(request, env, { error: 'Path inválido' }, 400);
  }

  try {
    await env.ATTACHMENTS.delete(path);
    return json(request, env, { ok: true, storagePath: path });
  } catch (error) {
    console.error('storage-delete', error);
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
}

async function listStorageFiles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawPrefix = url.searchParams.get('prefix') || 'attachments/';
  const prefix = rawPrefix.replace(/^\/+/, '');

  if (prefix && !prefix.startsWith('attachments/') && prefix !== 'attachments') {
    return json(request, env, { error: 'Prefixo inválido' }, 400);
  }

  const cursor = url.searchParams.get('cursor') || undefined;

  try {
    const listed = await env.ATTACHMENTS.list({
      prefix,
      cursor,
      limit: 1000,
      include: ['httpMetadata', 'customMetadata'],
    });

    const objects: StorageObjectInfo[] = listed.objects.map((object) => ({
      path: object.key,
      size: object.size,
      mimetype: object.httpMetadata?.contentType || null,
      uploaded: object.uploaded ? object.uploaded.toISOString() : null,
    }));

    return json(request, env, {
      objects,
      truncated: listed.truncated,
      cursor: listed.truncated ? listed.cursor : null,
    });
  } catch (error) {
    console.error('storage-list', error);
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
}

async function processImageR2(request: Request, env: Env): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const path = normalizeStoragePath(String(body.storagePath || ''));

  if (!path) {
    return json(request, env, { error: 'storagePath inválido' }, 400);
  }

  try {
    const object = await env.ATTACHMENTS.head(path);

    if (!object) {
      return json(request, env, { error: 'Arquivo não encontrado no R2' }, 404);
    }

    // O uploadImage já comprime as imagens para WebP no cliente.
    // Esta rota fica como ponto de extensão para OCR/thumbs/processamento futuro.
    return json(request, env, {
      ok: true,
      storagePath: path,
      mimeType: object.httpMetadata?.contentType || body.mimeType || null,
      sizeBytes: object.size,
      processed: false,
      note: 'Arquivo validado no R2. Processamento avançado fica para uma etapa posterior.',
    });
  } catch (error) {
    console.error('process-image', error);
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
}

async function storageAuditReportR2(request: Request, env: Env): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const knownPaths = new Set<string>(
    Array.isArray(body.knownPaths)
      ? body.knownPaths
          .filter((value: unknown) => typeof value === 'string')
          .map((value: string) => value.replace(/^\/+/, ''))
      : []
  );

  let cursor: string | undefined;
  let totalFiles = 0;
  const orphanFiles: Array<{ path: string; size: number }> = [];

  try {
    do {
      const listed = await env.ATTACHMENTS.list({
        prefix: 'attachments/',
        cursor,
        limit: 1000,
        include: ['customMetadata'],
      });

      totalFiles += listed.objects.length;

      for (const object of listed.objects) {
        const meta = object.customMetadata || {};
        const hasSourceMetadata = Boolean(meta.sourceTable || meta.sourceId || meta.sourceField);
        const preserved = meta.preserve === 'true';

        // Segurança: não marca como órfão arquivos explicitamente preservados
        // ou com vínculo de origem no próprio R2, mesmo que image_assets falhe.
        if (!knownPaths.has(object.key) && !hasSourceMetadata && !preserved) {
          orphanFiles.push({ path: object.key, size: object.size });
        }
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const orphanBytes = orphanFiles.reduce((sum, file) => sum + file.size, 0);

    return json(request, env, {
      runId: crypto.randomUUID(),
      totalFiles,
      knownAssets: knownPaths.size,
      orphans: orphanFiles.length,
      orphanBytes,
      sample: orphanFiles.slice(0, 20).map((file) => file.path),
      orphanFiles,
    });
  } catch (error) {
    console.error('storage-audit-report', error);
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
}

async function backfillWebpR2(request: Request, env: Env): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const paths: string[] = Array.isArray(body.paths)
    ? body.paths.filter((value: unknown) => typeof value === 'string')
    : [];

  if (!paths.length) {
    return json(request, env, { error: 'paths obrigatório' }, 400);
  }

  const results = [];

  for (const rawPath of paths) {
    const path = normalizeStoragePath(rawPath);

    if (!path) {
      results.push({
        storagePath: rawPath,
        status: 'error',
        reason: 'path inválido',
      });
      continue;
    }

    const object = await env.ATTACHMENTS.head(path);

    if (!object) {
      results.push({
        storagePath: path,
        status: 'error',
        reason: 'arquivo não encontrado no R2',
      });
      continue;
    }

    if (object.httpMetadata?.contentType === 'image/webp' || /\.webp$/i.test(path)) {
      results.push({
        storagePath: path,
        status: 'skipped',
        reason: 'já está em WebP',
        beforeBytes: object.size,
        afterBytes: object.size,
      });
      continue;
    }

    // Cloudflare Worker não faz conversão raster nativa neste fluxo.
    // Mantemos o backfill seguro e não destrutivo; novos uploads já chegam
    // comprimidos em WebP pelo cliente.
    results.push({
      storagePath: path,
      status: 'skipped',
      reason: 'conversão WebP de arquivos históricos adiada; arquivo preservado',
      beforeBytes: object.size,
      afterBytes: object.size,
    });
  }

  return json(request, env, { results });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const storageFilePrefix = '/storage/file/';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(allowedOrigin(request, env)),
      });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(request, env, {
        ok: true,
        service: 'japanflow-api',
        auth: 'firebase-id-token',
        routes: [
          'parse-calendar-events',
          'parse-schedule',
          'parse-inventory-label',
          'parse-purchase-order',
          'transcribe-image',
          'freight-calc',
          'storage-upload',
          'storage-file-public-read',
          'storage-list-admin',
          'process-image',
          'storage-audit-report-admin',
          'backfill-webp-admin',
          'admin-users-create',
        ],
      });
    }

    // Leitura R2 permanece pública temporariamente para preservar URLs já salvas
    // e <img src>. Mutações e APIs internas exigem Firebase Auth.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname.startsWith(storageFilePrefix)
    ) {
      return getStorageFile(
        request,
        env,
        url.pathname.slice(storageFilePrefix.length),
        request.method === 'HEAD'
      );
    }

    const authenticated = await authenticateRequest(request, env);
    if (authenticated instanceof Response) return authenticated;
    const caller = authenticated;

    if (request.method === 'POST' && url.pathname === '/admin/users/create') {
      return adminCreateUser(request, env, caller);
    }

    if (request.method === 'GET' && url.pathname === '/storage/list') {
      const denied = requireAdmin(request, env, caller);
      return denied || listStorageFiles(request, env);
    }

    if (request.method === 'DELETE' && url.pathname.startsWith(storageFilePrefix)) {
      return deleteStorageFile(request, env, url.pathname.slice(storageFilePrefix.length));
    }

    if (request.method === 'POST' && url.pathname === '/storage/upload') {
      return putStorageFile(request, env);
    }

    if (request.method !== 'POST') {
      return json(request, env, { error: 'Método não permitido' }, 405);
    }

    switch (url.pathname) {
      case '/parse-calendar-events':
        return parseCalendarEvents(request, env);
      case '/parse-schedule':
        return parseSchedule(request, env);
      case '/parse-inventory-label':
        return parseInventoryLabel(request, env);
      case '/parse-purchase-order':
        return parsePurchaseOrder(request, env);
      case '/transcribe-image':
        return transcribeImage(request, env);
      case '/freight-calc':
        return freightCalc(request, env);
      case '/process-image':
        return processImageR2(request, env);
      case '/storage-audit-report': {
        const denied = requireAdmin(request, env, caller);
        return denied || storageAuditReportR2(request, env);
      }
      case '/backfill-webp': {
        const denied = requireAdmin(request, env, caller);
        return denied || backfillWebpR2(request, env);
      }
      default:
        return json(request, env, { error: 'Rota não encontrada' }, 404);
    }
  },
};
