process.env.FIREBASE_AUTH_EMULATOR_HOST =
  '127.0.0.1:9099';

process.env.FIRESTORE_EMULATOR_HOST =
  '127.0.0.1:8085';

const {
  initializeApp,
} = await import(
  'firebase-admin/app'
);

const {
  getAuth,
} = await import(
  'firebase-admin/auth'
);

const {
  getFirestore,
} = await import(
  'firebase-admin/firestore'
);

const {
  loadEnv,
} = await import('vite');

const env = loadEnv(
  'qa',
  process.cwd(),
  ''
);

const username =
  env.QA_ADMIN_USER;

const password =
  env.QA_ADMIN_PASSWORD;

if (!username || !password) {
  throw new Error(
    'QA_ADMIN_USER / QA_ADMIN_PASSWORD ausentes.'
  );
}

const projectId =
  'demo-japanflow-qa';

initializeApp({
  projectId,
});

const auth = getAuth();
const db = getFirestore();

const normalizedUsername =
  username
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9._-]/g,
      '.'
    );

const email =
  `${normalizedUsername}@japanflow.local`;

let authUser;

try {
  authUser =
    await auth.getUserByEmail(email);

  await auth.updateUser(
    authUser.uid,
    {
      password,
      disabled: false,
    }
  );
} catch (error) {
  if (
    error?.code !==
    'auth/user-not-found'
  ) {
    throw error;
  }

  authUser =
    await auth.createUser({
      email,
      password,
    });
}

const userId = 'qa-admin';

await db
  .collection('users')
  .doc(userId)
  .set(
    {
      name: 'QA Admin',
      username:
        normalizedUsername,
      role: 'admin',
      sectors: ['ti'],
      function: 'QA',
      auth_uid:
        authUser.uid,
      auth_email: email,
      active: true,
    },
    {
      merge: true,
    }
  );

await db
  .collection('auth_links')
  .doc(authUser.uid)
  .set(
    {
      user_id: userId,
      role: 'admin',
      active: true,
    },
    {
      merge: true,
    }
  );

await db
  .collection('app_settings')
  .doc('global')
  .set(
    {
      nfToCarolEnabled: false,
      nfBoletoToCarolEnabled:
        false,
    },
    {
      merge: true,
    }
  );

console.log('');
console.log(
  '✅ JapanFlow QA preparado'
);
console.log(
  `Projeto: ${projectId}`
);
console.log(
  `Usuário: ${username}`
);
console.log(
  `UID: ${authUser.uid}`
);
console.log('');

await db
  .collection('users')
  .doc('emp-6')
  .set(
    {
      name: 'QA Funcionário',
      username: 'qa-funcionario',
      role: 'employee',
      sectors: ['administracao'],
      function: 'QA',
      active: true,
    },
    {
      merge: true,
    }
  );