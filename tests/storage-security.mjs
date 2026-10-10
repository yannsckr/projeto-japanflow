
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
  firestore: {
    host: '127.0.0.1',
    port: 8085,
  },
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
  // 1. Preparar usuários fictícios no Firestore Emulator
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

    await db.doc('auth_links/outsider-uid').set({
      user_id: 'outsider-user',
      role: 'employee',
      active: true,
    });
  });

  // 2. Criar contextos de autenticação
  const admin = env.authenticatedContext('admin-uid');
  const employee = env.authenticatedContext('employee-uid');
  const inactive = env.authenticatedContext('inactive-uid');
  const outsider = env.authenticatedContext('outsider-uid');
  const anonymous = env.unauthenticatedContext();

  // 3. Referências dos arquivos operacionais
  const adminFile = admin.storage().ref(path);
  const employeeFile = employee.storage().ref(path);
  const inactiveFile = inactive.storage().ref(path);
  const anonymousFile = anonymous.storage().ref(path);

  // 4. Referências dos anexos do chat privado
  const privatePath =
    'attachments/chat/private/admin-user/employee-user/security-test.webp';

  const adminPrivate = admin.storage().ref(privatePath);
  const employeePrivate = employee.storage().ref(privatePath);
  const outsiderPrivate = outsider.storage().ref(privatePath);

  // TESTES: Arquivos operacionais

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
      employee
        .storage()
        .ref('attachments/tasks/test.exe')
        .putString('arquivo', 'raw', {
          contentType: 'application/x-msdownload',
        })
    );
  });

  // TESTES: Anexos do chat privado

  await test('Participante cria anexo privado', async () => {
    await assertSucceeds(
      adminPrivate.putString('imagem privada', 'raw', {
        contentType: 'image/webp',
      })
    );
  });

  await test('Outro participante pode ler', async () => {
    await assertSucceeds(employeePrivate.getMetadata());
  });

  await test('Terceiro funcionário não pode ler', async () => {
    await assertFails(outsiderPrivate.getMetadata());
  });

  await test('Terceiro funcionário não pode enviar arquivo', async () => {
    await assertFails(
      outsider
        .storage()
        .ref('attachments/chat/private/admin-user/employee-user/novo.webp')
        .putString('acesso indevido', 'raw', {
          contentType: 'image/webp',
        })
    );
  });

  await test('Participante não pode sobrescrever', async () => {
    await assertFails(
      employeePrivate.putString('sobrescrita', 'raw', {
        contentType: 'image/webp',
      })
    );
  });

  await test('Administrador pode remover anexo privado', async () => {
    await assertSucceeds(adminPrivate.delete());
  });

  await test('Administrador pode excluir arquivo operacional', async () => {
    await assertSucceeds(adminFile.delete());
  });

  // RESULTADO FINAL
  console.log(`\nRESULTADO: ${passed} passaram, ${failed} falharam`);

  assert.equal(failed, 0, 'Existem falhas nas regras do Storage');
} finally {
  await env.cleanup();
}