import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    out[key] = value;
  }
  return out;
}

const root = process.cwd();
const env = {
  ...loadEnvFile(path.join(root, '.env')),
  ...loadEnvFile(path.join(root, '.env.local')),
  ...process.env,
};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    'VITE_FIREBASE_API_KEY e VITE_FIREBASE_PROJECT_ID precisam existir no .env/.env.local.'
  );
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const normalizeUsername = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '.');

const authEmail = (username) => `${normalizeUsername(username)}@japanflow.local`;

async function authRequest(endpoint, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function ensureAuthUser(username, password) {
  const email = authEmail(username);
  const signup = await authRequest('signUp', { email, password, returnSecureToken: true });

  if (signup.response.ok && signup.data.localId) {
    return { uid: signup.data.localId, email, created: true };
  }

  if (signup.data?.error?.message !== 'EMAIL_EXISTS') {
    throw new Error(signup.data?.error?.message || `Falha ao criar ${username}`);
  }

  const signin = await authRequest('signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });

  if (!signin.response.ok || !signin.data.localId) {
    throw new Error(
      `A conta ${email} já existe no Firebase Auth, mas a senha antiga não autenticou. Revise essa conta manualmente.`
    );
  }

  return { uid: signin.data.localId, email, created: false };
}

console.log('Buscando usuários legados em users/...');
const snapshot = await getDocs(collection(db, 'users'));

if (snapshot.empty) {
  console.error('A collection users está vazia. Bootstrap cancelado.');
  process.exit(1);
}

let migrated = 0;
let skipped = 0;
let failed = 0;

for (const userDoc of snapshot.docs) {
  const data = userDoc.data();
  const username = String(data.username || '').trim();
  const password = typeof data.password === 'string' ? data.password : '';
  const existingUid = String(data.auth_uid || data.authUid || '').trim();

  if (!username) {
    console.warn(`[SKIP] ${userDoc.id}: sem username`);
    skipped += 1;
    continue;
  }

  try {
    let uid = existingUid;
    let email = String(data.auth_email || data.authEmail || '').trim();

    if (!uid) {
      if (!password) {
        throw new Error('sem password legado e sem auth_uid');
      }
      const authUser = await ensureAuthUser(username, password);
      uid = authUser.uid;
      email = authUser.email;
    }

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'auth_links', uid),
      {
        user_id: userDoc.id,
        role: data.role === 'admin' ? 'admin' : 'employee',
        active: data.active !== false,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    batch.update(doc(db, 'users', userDoc.id), {
      auth_uid: uid,
      auth_email: email || authEmail(username),
      active: data.active !== false,
      password: deleteField(),
      updated_at: serverTimestamp(),
    });
    await batch.commit();

    console.log(`[OK] ${userDoc.id} @${username} -> ${uid}`);
    migrated += 1;
  } catch (error) {
    console.error(
      `[ERRO] ${userDoc.id} @${username}: ${error instanceof Error ? error.message : error}`
    );
    failed += 1;
  }
}

console.log(
  `\nBootstrap concluído: ${migrated} migrados, ${skipped} ignorados, ${failed} com erro.`
);
if (failed > 0) process.exitCode = 1;
