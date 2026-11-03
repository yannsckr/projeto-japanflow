import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

const env = await initializeTestEnvironment({
  projectId: 'demo-japanflow-qa',
  firestore: {
    host: '127.0.0.1',
    port: 8085,
    rules: fs.readFileSync('firestore.rules', 'utf8'),
  },
});

let passed = 0;
let failed = 0;

async function test(name, callback) {
  try {
    await callback();
    passed++;
    console.log(`PASSOU: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FALHOU: ${name}`, error.message);
  }
}

try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    for (const [uid, userId] of [
      ['user-a-uid', 'user-a'],
      ['user-b-uid', 'user-b'],
      ['user-c-uid', 'user-c'],
    ]) {
      await db.doc(`auth_links/${uid}`).set({
        user_id: userId,
        role: 'employee',
        active: true,
      });
    }

    await db.doc('auth_links/inactive-uid').set({
      user_id: 'inactive-user',
      role: 'employee',
      active: false,
    });

    await db.doc('messages/security-test-message').set({
      senderId: 'user-a',
      receiverId: 'user-b',
      content: 'Mensagem privada de teste',
      read: false,
      timestamp: new Date(),
    });
  });

  const userA = env.authenticatedContext('user-a-uid').firestore();
  const userB = env.authenticatedContext('user-b-uid').firestore();
  const userC = env.authenticatedContext('user-c-uid').firestore();
  const inactive = env.authenticatedContext('inactive-uid').firestore();
  const anonymous = env.unauthenticatedContext().firestore();

  const messagePath = 'messages/security-test-message';

  await test('Remetente pode ler sua mensagem', async () => {
    await assertSucceeds(userA.doc(messagePath).get());
  });

  await test('DestinatÃ¡rio pode ler sua mensagem', async () => {
    await assertSucceeds(userB.doc(messagePath).get());
  });

  await test('Terceiro funcionÃ¡rio nÃ£o pode ler', async () => {
    await assertFails(userC.doc(messagePath).get());
  });

  await test('FuncionÃ¡rio inativo nÃ£o pode ler', async () => {
    await assertFails(inactive.doc(messagePath).get());
  });

  await test('UsuÃ¡rio anÃ´nimo nÃ£o pode ler', async () => {
    await assertFails(anonymous.doc(messagePath).get());
  });

  await test('Autor nÃ£o pode editar conteÃºdo', async () => {
    await assertFails(userA.doc(messagePath).update({ content: 'Editada', edited: true }));
  });
  await test('DestinatÃ¡rio nÃ£o pode editar conteÃºdo', async () => {
    await assertFails(userB.doc(messagePath).update({ content: 'Editada' }));
  });
  await test('Autor pode apagar logicamente', async () => {
    await assertSucceeds(
      userA.doc(messagePath).update({ content: 'Mensagem apagada', deleted: true })
    );
  });
  await test('DestinatÃ¡rio nÃ£o pode marcar como lida sem timestamp', async () => {
    await assertFails(userB.doc(messagePath).update({ read: true }));
  });
  await test('DestinatÃ¡rio pode marcar como lida com timestamp do servidor', async () => {
    const { default: firebase } = await import('firebase/compat/app');
    await import('firebase/compat/firestore');
    await assertSucceeds(
      userB
        .doc(messagePath)
        .update({ read: true, read_at: firebase.firestore.FieldValue.serverTimestamp() })
    );
  });
  await test('Terceiro funcionÃ¡rio nÃ£o pode editar', async () => {
    await assertFails(
      userC.doc(messagePath).update({
        content: 'Mensagem alterada indevidamente',
      })
    );
  });

  await test('Remetente nÃ£o pode falsificar outro remetente', async () => {
    await assertFails(
      userA.collection('messages').add({
        senderId: 'user-b',
        receiverId: 'user-c',
        content: 'Mensagem falsificada',
        timestamp: new Date(),
        read: false,
      })
    );
  });

  console.log(`\nRESULTADO: ${passed} passaram, ${failed} falharam`);
  assert.equal(failed, 0, 'PermissÃµes do chat precisam de correÃ§Ã£o');
} finally {
  await env.cleanup();
}
