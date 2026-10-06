import http from 'node:http';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
  projectId: 'japanflow-erp',
});

const port = Number(process.env.PORT || 8080);

const auth = getAuth();
const db = getFirestore();

const allowedOrigins = new Set([
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://japanflow-erp.web.app',
  'https://japanflow.com.br',
]);

function corsHeaders(req) {
  const origin = req.headers.origin;

  return {
    'Access-Control-Allow-Origin':
      origin && allowedOrigins.has(origin) ? origin : 'https://japanflow.com.br',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req, res, status, body) {
  res.writeHead(status, {
    ...corsHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function bearerToken(req) {
  const authorization = req.headers.authorization || '';

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function authenticate(req) {
  const token = bearerToken(req);

  if (!token) {
    throw Object.assign(new Error('Não autenticado'), { status: 401 });
  }

  const decoded = await auth.verifyIdToken(token);

  const linkSnap = await db.collection('auth_links').doc(decoded.uid).get();

  if (!linkSnap.exists) {
    throw Object.assign(new Error('Conta sem vínculo com o ERP'), { status: 403 });
  }

  const link = linkSnap.data();

  if (!link?.user_id || link.active === false) {
    throw Object.assign(new Error('Acesso desativado'), { status: 403 });
  }

  const userSnap = await db.collection('users').doc(link.user_id).get();

  if (!userSnap.exists) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 403 });
  }

  const profile = userSnap.data();

  if (profile?.active === false) {
    throw Object.assign(new Error('Acesso desativado'), { status: 403 });
  }

  const isTi = Array.isArray(profile?.sectors) && profile.sectors.includes('ti');

  return {
    uid: decoded.uid,
    userId: link.user_id,
    role: link.role === 'admin' || isTi ? 'admin' : 'employee',
    profile,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req));
      return res.end();
    }

    if (req.method === 'GET' && req.url === '/health') {
      return json(req, res, 200, {
        ok: true,
        service: 'japanflow-web-api',
      });
    }

    if (req.method === 'GET' && req.url === '/auth/check') {
      const caller = await authenticate(req);

      return json(req, res, 200, {
        ok: true,
        userId: caller.userId,
        role: caller.role,
      });
    }

    return json(req, res, 404, {
      error: 'Not found',
    });
  } catch (error) {
    console.error('request', error);

    return json(req, res, Number(error?.status || 500), {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`JapanFlow Web API running on port ${port}`);
});
