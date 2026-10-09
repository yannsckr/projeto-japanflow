import http from 'node:http';
import { handleScheduleAi } from './schedule-ai.js';
import { handleCalendarAi } from './calendar-ai.js';
import crypto from 'node:crypto';
import { handleGeminiImage } from './gemini.js';

import { initializeApp, applicationDefault } from 'firebase-admin/app';

import { getAuth } from 'firebase-admin/auth';

import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getMessaging } from 'firebase-admin/messaging';

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'japanflow-erp';

const usingFirebaseEmulator =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) || Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

initializeApp({
  projectId,

  ...(usingFirebaseEmulator
    ? {}
    : {
        credential: applicationDefault(),
      }),
});

const port = Number(process.env.PORT || 8080);

const auth = getAuth();

const db = getFirestore();

const messaging = getMessaging();

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

function normalizeUsername(value) {
  return String(value || '')
    .trim()

    .toLowerCase()

    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .replace(/[^a-z0-9._-]/g, '.');
}

function authEmailForUsername(username) {
  return `${normalizeUsername(username)}@japanflow.local`;
}

function randomTemporaryPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

  const bytes = crypto.randomBytes(length);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
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

function requireAdmin(caller) {
  if (caller.role !== 'admin') {
    throw Object.assign(new Error('Acesso de administrador necessário'), { status: 403 });
  }
}

async function adminCreateUser(req, res, caller) {
  requireAdmin(caller);

  const body = await readBody(req);

  const name = String(body.name || '').trim();

  const username = normalizeUsername(body.username);

  const password = String(body.password || '');

  const role = body.role === 'admin' ? 'admin' : 'employee';

  const sectors = Array.isArray(body.sectors)
    ? body.sectors.filter((value) => typeof value === 'string')
    : [];

  const userFunction = String(body.function || '').trim();

  if (!name || !username || password.length < 6) {
    return json(req, res, 400, {
      error: 'Nome, usuário e senha válida são obrigatórios',
    });
  }

  const authEmail = authEmailForUsername(username);

  let firebaseUser;

  try {
    firebaseUser = await auth.createUser({
      email: authEmail,

      password,

      disabled: false,
    });
  } catch (error) {
    const code = String(error?.code || '');

    return json(req, res, 400, {
      error: code.includes('email-already-exists')
        ? 'Usuário já existe'
        : 'Não foi possível criar a conta no Firebase Auth',
    });
  }

  const prefix = role === 'admin' ? 'admin' : 'emp';

  const userId = `${prefix}-${Date.now()}`;

  const now = FieldValue.serverTimestamp();

  try {
    const batch = db.batch();

    batch.set(db.collection('users').doc(userId), {
      name,

      username,

      role,

      sectors,

      function: userFunction || null,

      avatar: null,

      backgroundColor: null,

      auth_uid: firebaseUser.uid,

      auth_email: authEmail,

      active: true,

      created_at: now,

      updated_at: now,
    });

    batch.set(db.collection('auth_links').doc(firebaseUser.uid), {
      user_id: userId,

      role,

      active: true,

      created_at: now,

      updated_at: now,
    });

    await batch.commit();

    return json(req, res, 200, {
      user: {
        id: userId,

        name,

        username,

        role,

        sectors,

        function: userFunction || undefined,

        authUid: firebaseUser.uid,

        authEmail,

        active: true,
      },
    });
  } catch (error) {
    await auth.deleteUser(firebaseUser.uid).catch(() => undefined);

    throw error;
  }
}

async function adminUpdateUser(req, res, caller) {
  requireAdmin(caller);

  const body = await readBody(req);

  const userId = String(body.userId || '').trim();

  const requestedUsername = normalizeUsername(body.username);

  if (!userId || !requestedUsername) {
    return json(req, res, 400, {
      error: 'userId e username são obrigatórios',
    });
  }

  const userRef = db.collection('users').doc(userId);

  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return json(req, res, 404, {
      error: 'Usuário não encontrado',
    });
  }

  const user = userSnap.data();

  const authUid = String(user?.auth_uid || '').trim();

  if (!authUid) {
    return json(req, res, 409, {
      error: 'Usuário sem vínculo com Firebase Auth',
    });
  }

  const authEmail = authEmailForUsername(requestedUsername);

  try {
    await auth.updateUser(authUid, {
      email: authEmail,
    });
  } catch (error) {
    const code = String(error?.code || '');

    return json(req, res, code.includes('email-already-exists') ? 409 : 502, {
      error: code.includes('email-already-exists')
        ? 'Esse @ já está em uso'
        : 'Não foi possível atualizar o @ no Firebase Auth',
    });
  }

  await userRef.update({
    username: requestedUsername,

    auth_email: authEmail,

    updated_at: FieldValue.serverTimestamp(),
  });

  console.log('admin-update-user', {
    targetUserId: userId,

    username: requestedUsername,

    updatedBy: caller.userId,
  });

  return json(req, res, 200, {
    ok: true,

    userId,

    username: requestedUsername,

    authEmail,
  });
}

async function adminDeleteUser(req, res, caller) {
  requireAdmin(caller);

  const body = await readBody(req);

  const userId = String(body.userId || '').trim();

  if (!userId) {
    return json(req, res, 400, {
      error: 'userId é obrigatório',
    });
  }

  if (userId === caller.userId) {
    return json(req, res, 400, {
      error: 'Você não pode excluir a própria conta',
    });
  }

  const userRef = db.collection('users').doc(userId);

  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return json(req, res, 404, {
      error: 'Usuário não encontrado',
    });
  }

  const user = userSnap.data();

  const authUid = String(user?.auth_uid || '').trim();

  const batch = db.batch();

  batch.update(userRef, {
    active: false,

    deleted_at: FieldValue.serverTimestamp(),

    deleted_by: caller.userId,

    updated_at: FieldValue.serverTimestamp(),
  });

  if (authUid) {
    batch.set(
      db.collection('auth_links').doc(authUid),

      {
        active: false,

        updated_at: FieldValue.serverTimestamp(),
      },

      { merge: true }
    );
  }

  await batch.commit();

  let authDeleted = false;

  if (authUid) {
    try {
      await auth.deleteUser(authUid);

      authDeleted = true;
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        return json(req, res, 502, {
          error:
            'O acesso foi desativado no JapanFlow, mas a conta Firebase Auth não pôde ser removida.',
        });
      }

      authDeleted = true;
    }
  }

  console.log('admin-delete-user', {
    targetUserId: userId,

    deletedBy: caller.userId,

    authDeleted,
  });

  return json(req, res, 200, {
    ok: true,

    userId,

    authDeleted,
  });
}

async function adminResetUserAccess(req, res, caller) {
  requireAdmin(caller);

  const body = await readBody(req);

  const userId = String(body.userId || '').trim();

  if (!userId) {
    return json(req, res, 400, {
      error: 'userId é obrigatório',
    });
  }

  const userRef = db.collection('users').doc(userId);

  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return json(req, res, 404, {
      error: 'Usuário não encontrado',
    });
  }

  const user = userSnap.data();

  const authUid = String(user?.auth_uid || '').trim();

  if (!authUid) {
    return json(req, res, 404, {
      error: 'Usuário sem vínculo com Firebase Auth',
    });
  }

  const temporaryPassword = randomTemporaryPassword();

  await auth.updateUser(authUid, {
    password: temporaryPassword,
  });

  await userRef.update({
    access_reset_at: FieldValue.serverTimestamp(),

    access_reset_by: caller.userId,

    must_change_password: true,

    updated_at: FieldValue.serverTimestamp(),
  });

  console.log('admin-reset-access', {
    targetUserId: userId,

    resetBy: caller.userId,
  });

  return json(req, res, 200, {
    ok: true,

    userId,

    temporaryPassword,
  });
}

async function passwordResetStatus(req, res, caller) {
  const userSnap = await db.collection('users').doc(caller.userId).get();

  if (!userSnap.exists) {
    return json(req, res, 404, {
      error: 'Usuário não encontrado',
    });
  }

  return json(req, res, 200, {
    mustChangePassword: userSnap.data()?.must_change_password === true,
  });
}

async function completePasswordReset(req, res, caller) {
  await db.collection('users').doc(caller.userId).update({
    must_change_password: false,

    password_changed_at: FieldValue.serverTimestamp(),

    updated_at: FieldValue.serverTimestamp(),
  });

  console.log('password-reset-complete', {
    userId: caller.userId,
  });

  return json(req, res, 200, {
    ok: true,
  });
}

async function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeDocumentPart(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_-]/g, '_')

    .slice(0, 80);
}

async function registerPushSubscription(req, res, caller) {
  const body = await readBody(req);

  const token = String(body.token || '').trim();

  const platform = String(body.platform || 'web')
    .trim()

    .slice(0, 40);

  const userAgent = String(body.userAgent || '')
    .trim()

    .slice(0, 500);

  if (!token || token.length < 20 || token.length > 4096) {
    return json(req, res, 400, {
      error: 'Token FCM inválido',
    });
  }

  const tokenHash = await sha256Hex(token);

  const documentId = `push_${safeDocumentPart(caller.userId)}_${tokenHash.slice(0, 40)}`;

  await db.collection('push_subscriptions').doc(documentId).set(
    {
      user_id: caller.userId,

      token,

      platform,

      user_agent: userAgent,

      active: true,

      updated_at: FieldValue.serverTimestamp(),

      created_at: FieldValue.serverTimestamp(),
    },

    {
      merge: true,
    }
  );

  return json(req, res, 200, {
    ok: true,

    subscriptionId: documentId,

    userId: caller.userId,
  });
}

async function listPushSubscriptions(userId) {
  const snapshot = await db

    .collection('push_subscriptions')

    .where('user_id', '==', userId)

    .where('active', '==', true)

    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,

    ...doc.data(),
  }));
}

async function sendPushToUser(req, res, caller) {
  const body = await readBody(req);

  const userId = String(body.userId || '').trim();

  const title = String(body.title || '')
    .trim()

    .slice(0, 120);

  const messageBody = String(body.body || '')
    .trim()

    .slice(0, 500);

  const requestedUrl = String(body.url || '/').trim();

  const url = requestedUrl.startsWith('/') ? requestedUrl.slice(0, 500) : '/';

  const tag =
    typeof body.tag === 'string' && body.tag.trim()
      ? body.tag.trim().slice(0, 120)
      : `japanflow-${Date.now()}`;

  if (!userId || !title || !messageBody) {
    return json(req, res, 400, {
      error: 'userId, title e body são obrigatórios',
    });
  }

  const subscriptions = await listPushSubscriptions(userId);

  if (!subscriptions.length) {
    return json(req, res, 200, {
      ok: true,

      userId,

      found: 0,

      sent: 0,

      failed: 0,

      deactivated: 0,
    });
  }

  let sent = 0;

  let failed = 0;

  let deactivated = 0;

  for (const subscription of subscriptions) {
    try {
      await messaging.send({
        token: subscription.token,

        data: {
          title,

          body: messageBody,

          url,

          tag,
        },

        webpush: {
          headers: {
            Urgency: 'high',

            TTL: '86400',
          },
        },
      });

      sent += 1;
    } catch (error) {
      failed += 1;

      const code = String(error?.code || '');

      const invalidToken =
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token');

      if (invalidToken) {
        await db.collection('push_subscriptions').doc(subscription.id).update({
          active: false,

          updated_at: FieldValue.serverTimestamp(),
        });

        deactivated += 1;
      }

      console.warn('push-send FCM', {
        targetUserId: userId,

        callerUserId: caller.userId,

        subscriptionId: subscription.id,

        code,
      });
    }
  }

  console.log('push-send summary', {
    targetUserId: userId,

    callerUserId: caller.userId,

    found: subscriptions.length,

    sent,

    failed,

    deactivated,
  });

  return json(req, res, 200, {
    ok: failed === 0,

    userId,

    found: subscriptions.length,

    sent,

    failed,

    deactivated,
  });
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

    const caller = await authenticate(req);

    if (
      req.method === 'POST' &&
      ['/parse-inventory-label', '/parse-purchase-order', '/transcribe-image'].includes(req.url)
    ) {
      const body = await readBody(req);
      const result = await handleGeminiImage(req.url, body);
      return json(req, res, result.status, result.body);
    }

    if (req.method === 'POST' && req.url === '/admin/users/create') {
      return adminCreateUser(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/admin/users/update') {
      return adminUpdateUser(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/admin/users/delete') {
      return adminDeleteUser(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/admin/users/reset-access') {
      return adminResetUserAccess(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/account/password-reset-status') {
      return passwordResetStatus(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/account/password-reset-complete') {
      return completePasswordReset(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/push/register') {
      return registerPushSubscription(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/push/send') {
      return sendPushToUser(req, res, caller);
    }

    if (req.method === 'POST' && req.url === '/parse-calendar-events') {
      const body = await readBody(req);
      const result = await handleCalendarAi(body);
      return json(req, res, result.status, result.body);
    }

    if (req.method === 'POST' && req.url === '/parse-schedule') {
      const body = await readBody(req);
      const result = await handleScheduleAi(body);
      return json(req, res, result.status, result.body);
    }

    return json(req, res, 404, {
      error: 'Not found',
    });
  } catch (error) {
    console.error('request', error);

    const authErrorCode = String(error?.code || '');

    const status = error?.status || (authErrorCode.startsWith('auth/') ? 401 : 500);

    return json(req, res, Number(status), {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`JapanFlow Web API running on port ${port}`);
});
