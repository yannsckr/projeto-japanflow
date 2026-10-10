
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

const projectId = 'demo-japanflow-qa';
const path = 'attachments/tasks/security-test.webp';

const env = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8085 },
  storage: {
    host: '127.0.0.1',
    port: 9199,
    rules: fs.readFileSync('storage.rules', 'utf8'),
  },
});

let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASSOU: ${label}`);
  } catch (error) {
    failed++;
    console.error(`FALHOU: ${label}`, error.message);
  }
}

try {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('auth_links/admin-uid').set({
      user_id: 'admin-user',
      role: 'admin',
      active: true,
    });
    await db.doc('auth_links/employee-uid').set({
      user_id: 'employee-user',
      role: 'employee',
      active: true,
    });
    await db.doc('auth_links/inactive-uid').set({
      user_id: 'inactive-user',
      role: 'employee',
      active: false,
    });
  });

  const admin = env.authenticatedContext('admin-uid');
  const employee = env.authenticatedContext('employee-uid');
  const inactive = env.authenticatedContext('inactive-uid');
  const anonymous = env.unauthenticatedContext();

  const adminFile = admin.storage().ref(path);
  const employeeFile = employee.storage().ref(path);
  const inactiveFile = inactive.storage().ref(path);
  const anonymousFile = anonymous.storage().ref(path);

  await test('Admin cria arquivo válido', async () => {
    await assertSucceeds(
      adminFile.putString('arquivo de teste', 'raw', {
        contentType: 'image/webp',
      })
    );
  });

  await test('Funcionário ativo consegue ler arquivo', async () => {
    await assertSucceeds(employeeFile.getMetadata());
  });

  await test('Usuário inativo não consegue ler', async () => {
    await assertFails(inactiveFile.getMetadata());
  });

  await test('Usuário anônimo não consegue ler', async () => {
    await assertFails(anonymousFile.getMetadata());
  });

  await test('Funcionário não consegue excluir', async () => {
    await assertFails(employeeFile.delete());
  });

  await test('Funcionário não consegue sobrescrever', async () => {
    await assertFails(
      employeeFile.putString('alteração indevida', 'raw', {
        contentType: 'image/webp',
      })
    );
  });

  await test('Upload executável é bloqueado', async () => {
    await assertFails(
      employee.storage().ref('attachments/tasks/test.exe')
        .putString('arquivo', 'raw', {
          contentType: 'application/x-msdownload',
        })
    );
  });

  await test('Administrador pode excluir', async () => {
    await assertSucceeds(adminFile.delete());
  });

  console.log(`\nRESULTADO: ${passed} passaram, ${failed} falharam`);
  assert.equal(failed, 0, 'Existem falhas nas regras do Storage');
} finally {
  await env.cleanup();
}