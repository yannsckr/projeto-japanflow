import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

// Run with auth,firestore,storage emulators. Uses fake accounts only.
const projectId = 'demo-japanflow-qa';
const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
const storageRules = fs.readFileSync('storage.rules', 'utf8');

assert.match(
  firestoreRules,
  /match\s+\/reference_diagrams\/\{diagramId\}/,
  'Firestore rules missing reference_diagrams'
);
assert.match(
  storageRules,
  /match\s+\/reference_diagrams\/\{userId\}\/\{fileName\}/,
  'Storage rules missing reference_diagrams'
);
assert.match(
  firestoreRules,
  /collection\s*!=\s*'reference_diagrams'/,
  'Firestore catch-all must exclude reference_diagrams'
);

const env = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8085, rules: firestoreRules },
  storage: { host: '127.0.0.1', port: 9199, rules: storageRules },
});

let passed = 0;
let failed = 0;
const test = async (name, task) => {
  try {
    await task();
    passed++;
    console.log(`PASSOU: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FALHOU: ${name}: ${error?.message ?? error}`);
  }
};

try {
  const accounts = [
    ['adm-uid', 'adm-user', 'admin', ['administracao'], true],
    ['sales-uid', 'sales-user', 'employee', ['vendas'], true],
    ['other-uid', 'other-user', 'employee', ['expedicao'], true],
    ['inactive-uid', 'inactive-user', 'admin', ['vendas'], false],
  ];
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, id, role, sectors, active] of accounts) {
      await db.doc(`auth_links/${uid}`).set({ user_id: id, role, active });
      await db.doc(`users/${id}`).set({ role, sectors, active });
    }
  });

  const admin = env.authenticatedContext('adm-uid');
  const sales = env.authenticatedContext('sales-uid');
  const other = env.authenticatedContext('other-uid');
  const inactive = env.authenticatedContext('inactive-uid');
  const anon = env.unauthenticatedContext();
  const diagramId = 'security-diagram';
  const path = `reference_diagrams/${diagramId}`;
  const objectPath = 'reference_diagrams/adm-user/security-test.png';

  await test('Admin envia imagem técnica PNG', () =>
    assertSucceeds(
      admin
        .storage()
        .ref(objectPath)
        .putString('imagem de teste', 'raw', { contentType: 'image/png' })
    ));
  await test('Admin lê imagem técnica', () =>
    assertSucceeds(admin.storage().ref(objectPath).getMetadata()));
  await test('Vendas lê imagem técnica', () =>
    assertSucceeds(sales.storage().ref(objectPath).getMetadata()));
  await test('Outro setor não lê imagem técnica', () =>
    assertFails(other.storage().ref(objectPath).getMetadata()));
  await test('Inativo não lê imagem técnica', () =>
    assertFails(inactive.storage().ref(objectPath).getMetadata()));
  await test('Anônimo não lê imagem técnica', () =>
    assertFails(anon.storage().ref(objectPath).getMetadata()));
  await test('Vendas não envia imagem técnica', () =>
    assertFails(
      sales
        .storage()
        .ref('reference_diagrams/sales-user/sales-test.png')
        .putString('png', 'raw', { contentType: 'image/png' })
    ));
  await test('Outro setor não envia imagem técnica', () =>
    assertFails(
      other
        .storage()
        .ref('reference_diagrams/other-user/other-test.png')
        .putString('png', 'raw', { contentType: 'image/png' })
    ));
  await test('Admin não grava na pasta de outro usuário', () =>
    assertFails(
      admin
        .storage()
        .ref('reference_diagrams/sales-user/admin-test.png')
        .putString('png', 'raw', { contentType: 'image/png' })
    ));
  await test('Admin não envia arquivo não-imagem', () =>
    assertFails(
      admin
        .storage()
        .ref('reference_diagrams/adm-user/security-test.exe')
        .putString('exe', 'raw', { contentType: 'application/x-msdownload' })
    ));
  await test('Admin não sobrescreve imagem técnica', () =>
    assertFails(
      admin.storage().ref(objectPath).putString('alterada', 'raw', { contentType: 'image/png' })
    ));
  await test('Admin não apaga imagem diretamente', () =>
    assertFails(admin.storage().ref(objectPath).delete()));

  const compat = await import('firebase/compat/app');
  await import('firebase/compat/firestore');
  const FieldValue = compat.default.firestore.FieldValue;
  const createRecord = (title = 'Suspensão traseira') => ({
    brand: 'Mitsubishi',
    system: 'Suspensão',
    title,
    vehicle: 'Pajero TR4',
    year_range: '2000-2010',
    image_path: objectPath,
    markers: [],
    created_by: 'adm-user',
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });
  await test('Admin cria diagrama no Firestore', () =>
    assertSucceeds(admin.firestore().doc(path).set(createRecord())));
  await test('Admin lê diagrama', () => assertSucceeds(admin.firestore().doc(path).get()));
  await test('Vendas lê diagrama', () => assertSucceeds(sales.firestore().doc(path).get()));
  await test('Outro setor não lê diagrama', () => assertFails(other.firestore().doc(path).get()));
  await test('Inativo não lê diagrama', () => assertFails(inactive.firestore().doc(path).get()));
  await test('Anônimo não lê diagrama', () => assertFails(anon.firestore().doc(path).get()));
  await test('Vendas não cria diagrama', () =>
    assertFails(
      sales
        .firestore()
        .doc('reference_diagrams/sales-attempt')
        .set({ ...createRecord(), created_by: 'sales-user' })
    ));
  await test('Admin não falsifica autor', () =>
    assertFails(
      admin
        .firestore()
        .doc('reference_diagrams/spoof-attempt')
        .set({ ...createRecord(), created_by: 'sales-user' })
    ));
  await test('Admin atualiza círculos', () =>
    assertSucceeds(
      admin.firestore().doc(path).update({ markers: [], updated_at: FieldValue.serverTimestamp() })
    ));
  await test('Vendas não altera círculos', () =>
    assertFails(
      sales.firestore().doc(path).update({ markers: [], updated_at: FieldValue.serverTimestamp() })
    ));
  await test('Admin não altera autor ou imagem', () =>
    assertFails(
      admin.firestore().doc(path).update({
        image_path: 'reference_diagrams/adm-user/troca.png',
        updated_at: FieldValue.serverTimestamp(),
      })
    ));
  await test('Admin não apaga diagrama diretamente', () =>
    assertFails(admin.firestore().doc(path).delete()));

  console.log(`\nRESULTADO REFERÊNCIAS 2D: ${passed} passaram, ${failed} falharam`);
  assert.equal(failed, 0, 'Falhas de segurança no catálogo de diagramas');
} finally {
  await env.cleanup();
}
