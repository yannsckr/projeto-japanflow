import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

const env = await initializeTestEnvironment({
  projectId: 'demo-japanflow-chat-queries',
  firestore: {
    host: '127.0.0.1',
    port: 8085,
    rules: fs.readFileSync('firestore.rules', 'utf8'),
  },
});

let passed = 0;
let failed = 0;

async function test(name, action) {
  try {
    await action();
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

    for (const id of ['a', 'b', 'c']) {
      await db.doc(`auth_links/uid-${id}`).set({
        user_id: `user-${id}`,
        role: 'employee',
        active: true,
      });
    }

    await db.doc('messages/m1').set({
      senderId: 'user-a',
      receiverId: 'user-b',
      content: 'Mensagem A para B',
      timestamp: new Date(),
      read: false,
    });

    await db.doc('messages/m2').set({
      senderId: 'user-b',
      receiverId: 'user-a',
      content: 'Mensagem B para A',
      timestamp: new Date(),
      read: false,
    });

    await db.doc('messages/m3').set({
      senderId: 'user-b',
      receiverId: 'user-c',
      content: 'Mensagem B para C',
      timestamp: new Date(),
      read: false,
    });
  });

  const userA = env.authenticatedContext('uid-a').firestore();
  const userC = env.authenticatedContext('uid-c').firestore();

  await test('Consultar mensagens enviadas', async () => {
    await assertSucceeds(
      userA
        .collection('messages')
        .where('senderId', '==', 'user-a')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get()
    );
  });

  await test('Consultar mensagens recebidas', async () => {
    await assertSucceeds(
      userA
        .collection('messages')
        .where('receiverId', '==', 'user-a')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get()
    );
  });

  await test('Bloquear consulta geral de mensagens', async () => {
    await assertFails(userA.collection('messages').orderBy('timestamp', 'desc').limit(100).get());
  });

  await test('Bloquear consulta de mensagens alheias', async () => {
    await assertFails(
      userC.collection('messages').where('senderId', '==', 'user-a').limit(100).get()
    );
  });

  console.log(`\nRESULTADO: ${passed} passaram, ${failed} falharam`);
  assert.equal(failed, 0);
} finally {
  await env.cleanup();
}
