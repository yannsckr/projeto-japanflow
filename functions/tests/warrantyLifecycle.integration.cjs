'use strict';
/**
 * JapanFlow — teste integrado (Auth + Functions + Firestore Emulators).
 * NÃO usa dados de produção. Requer os três emuladores e o projectId fixo demo-japanflow-warranties.
 * Executar da RAIZ do repositório com:
 *   npx firebase-tools emulators:exec --only auth,firestore,functions --project demo-japanflow-warranties "node functions/tests/warrantyLifecycle.integration.cjs"
 */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const PROJECT = 'demo-japanflow-warranties';
const AUTH_HOST = '127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1:8085';
const FUNCTIONS_HOST = '127.0.0.1';
const FUNCTIONS_PORT = 5001;

if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT) {
  throw new Error('ABORTADO: o projeto configurado não é demo-japanflow-warranties.');
}
if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== PROJECT) {
  throw new Error('ABORTADO: GOOGLE_CLOUD_PROJECT aponta para outro projeto.');
}
// Proteção contra qualquer acesso acidental a serviços de produção.
process.env.GCLOUD_PROJECT = PROJECT;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const firebaseAdmin = require('firebase-admin');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore: clientFirestore, connectFirestoreEmulator, doc, updateDoc, deleteDoc, setDoc, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');

firebaseAdmin.initializeApp({ projectId: PROJECT });
const db = firebaseAdmin.firestore();
const runId = randomUUID().slice(0, 10);
const apps = [];
let checks = 0;
const log = title => { checks++; console.log(`  OK ${checks}: ${title}`); };
const bad = (e) => `${e?.code || 'unknown'}: ${e?.message || String(e)}`;

async function expectDeny(label, operation, codes = ['permission-denied', 'functions/permission-denied']) {
  try {
    await operation();
  } catch (e) {
    assert(codes.includes(e?.code), `${label}: falha diferente de bloqueio de autorização: ${bad(e)}`);
    log(label);
    return;
  }
  throw new Error(`${label}: OPERAÇÃO PROIBIDA FOI PERMITIDA`);
}

async function createActor(name, { role = 'employee', sectors = ['garantias'], active = true, linkActive = true, feature = false } = {}) {
  const app = initializeApp({
    projectId: PROJECT,
    apiKey: 'test-only-api-key',
    authDomain: `${PROJECT}.firebaseapp.com`,
    appId: 'test-only-firebase-app',
  }, `qa-warranty-${runId}-${name}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const firestore = clientFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8085);
  const funcs = getFunctions(app, 'southamerica-east1');
  connectFunctionsEmulator(funcs, FUNCTIONS_HOST, FUNCTIONS_PORT);

  const cred = await createUserWithEmailAndPassword(auth, `qa-${name}-${runId}@example.test`, 'EmulatorTestOnly!123');
  const employeeId = `qa-${runId}-${name}`;
  await db.doc(`auth_links/${cred.user.uid}`).set({ user_id: employeeId, role, active: linkActive });
  await db.doc(`users/${employeeId}`).set({ name, sectors, active });
  if (feature) {
    await db.doc(`user_feature_permissions/tracking_warranties__${employeeId}`).set({
      enabled: true, feature_key: 'tracking_warranties', user_id: employeeId,
    });
  }
  return {
    employeeId,
    firestore,
    uid: cred.user.uid,
    manage: (warrantyId, action, extra = {}) =>
      httpsCallable(funcs, 'manageWarrantyLifecycle')({ warrantyId, action, ...extra }),
  };
}

async function createClaim(name, owner, { origin = 'manual', tasks = 1, withPrearchivedTask = false } = {}) {
  const id = `qa_${runId}_${name}`;
  await db.doc(`warranty_claims/${id}`).set({
    requested_by: owner,
    origin,
    customer_name: 'CLIENTE FICTICIO — TESTE LOCAL',
    status: 'pending',
    created_at: firebaseAdmin.firestore.Timestamp.now(),
    updated_at: firebaseAdmin.firestore.Timestamp.now(),
  });
  const taskIds = [];
  for (let i = 0; i < tasks; i++) {
    const taskId = `qa_task_${runId}_${name}_${i}`;
    const value = { warranty_id: id, board_visible: true, sector: 'garantias' };
    if (withPrearchivedTask && i === tasks - 1) {
      value.archived_at = firebaseAdmin.firestore.Timestamp.fromMillis(1700000000000);
      value.archived_by = 'prior-archive';
      value.board_visible = false;
    }
    await db.doc(`tasks/${taskId}`).set(value);
    taskIds.push(taskId);
  }
  return { id, taskIds };
}

async function main() {
  console.log('JapanFlow: integração real SOMENTE nos emuladores do projeto demo.');
  const admin = await createActor('admin', { role: 'admin', sectors: [] });
  const owner = await createActor('owner', { sectors: ['garantias'] });
  const colleague = await createActor('colleague', { sectors: ['vendas'] });
  const site = await createActor('site', { sectors: ['site', 'estoque'] });
  const expedition = await createActor('expedition', { sectors: ['estoque', 'expedicao'] });
  const withoutModule = await createActor('no-module', { sectors: ['estoque'] });
  const inactive = await createActor('inactive', { sectors: ['garantias'], active: false });
  const explicit = await createActor('explicit', { sectors: [], feature: true });
  const ti = await createActor('ti', { sectors: ['ti'] });

  // Usuário autor: operações permitidas e atualização transacional das tarefas.
  const own = await createClaim('own', owner.employeeId, { tasks: 2, withPrearchivedTask: true });
  await expectDeny('colega não exclui garantia alheia', () => colleague.manage(own.id, 'delete'));
  await expectDeny('usuário sem módulo não exclui garantia alheia', () => withoutModule.manage(own.id, 'delete'));
  await expectDeny('usuário inativo não exclui garantia alheia', () => inactive.manage(own.id, 'delete'));
  await expectDeny('tentativa de forjar userId do admin não concede acesso', () => colleague.manage(own.id, 'delete', { userId: admin.employeeId }));

  const first = (await owner.manage(own.id, 'delete')).data;
  assert.equal(first.archivedTasks, 1);
  const deletedClaim = (await db.doc(`warranty_claims/${own.id}`).get()).data();
  assert.equal(deletedClaim.deleted_by, owner.employeeId);
  assert(deletedClaim.deleted_at, 'Garantia não recebeu deleted_at');
  const archived = (await db.doc(`tasks/${own.taskIds[0]}`).get()).data();
  assert.equal(archived.board_visible, false);
  assert.equal(archived.warranty_archived_by_deletion, own.id);
  assert(archived.archived_at.isEqual(deletedClaim.deleted_at));
  const priorArchive = (await db.doc(`tasks/${own.taskIds[1]}`).get()).data();
  assert.equal(priorArchive.archived_by, 'prior-archive');
  log('autor exclui; somente tarefa ativa é arquivada, na mesma transação');

  await expectDeny('colega não restaura garantia alheia', () => colleague.manage(own.id, 'restore'));
  const restored = (await owner.manage(own.id, 'restore')).data;
  assert.equal(restored.restoredTasks, 1);
  const restoredClaim = (await db.doc(`warranty_claims/${own.id}`).get()).data();
  assert.equal(Object.hasOwn(restoredClaim, 'deleted_at'), false);
  const restoredTask = (await db.doc(`tasks/${own.taskIds[0]}`).get()).data();
  assert.equal(restoredTask.board_visible, true);
  assert.equal(Object.hasOwn(restoredTask, 'archived_at'), false);
  assert.equal(Object.hasOwn(restoredTask, 'warranty_archived_by_deletion'), false);
  const history = await db.collection('warranty_updates').where('warranty_id', '==', own.id).get();
  assert.equal(history.size, 2);
  log('autor restaura; tarefa e histórico preservados corretamente');

  // Compatibilidade: operação normal de edição no cliente permanece liberada.
  await updateDoc(doc(owner.firestore, 'warranty_claims', own.id), {
    customer_name: 'CLIENTE FICTICIO — EDICAO DE TESTE',
  });
  assert.equal((await db.doc(`warranty_claims/${own.id}`).get()).data().customer_name,
    'CLIENTE FICTICIO — EDICAO DE TESTE');
  log('edição normal da garantia pelo autor continua funcionando');

  // Fluxo real da interface: cria garantia e depois tarefa em addDoc separado.
  const manualFromClientId = `qa_${runId}_created_by_client`;
  const manualTaskId = `qa_task_${runId}_created_by_client`;
  await setDoc(doc(owner.firestore, 'warranty_claims', manualFromClientId), {
    requested_by: owner.employeeId,
    customer_name: 'CLIENTE FICTICIO — CRIADO PELO CLIENTE',
    status: 'pending',
    created_at: serverTimestamp(),
  });
  await setDoc(doc(owner.firestore, 'tasks', manualTaskId), {
    warranty_id: manualFromClientId,
    board_visible: true,
    sector: 'garantias',
    title: '🛡️ Garantia: CLIENTE FICTICIO - ITEM',
    description: 'Nova garantia fictícia',
    status: 'todo',
    priority: 'high',
    assignee_id: 'emp-12',
    created_by: owner.employeeId,
    deadline: '2026-11-01',
    status_history: [{ status: 'todo', enteredAt: new Date().toISOString() }],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  assert((await db.doc(`warranty_claims/${manualFromClientId}`).get()).exists);
  assert((await db.doc(`tasks/${manualTaskId}`).get()).exists);
  log('criação manual sequencial da ficha e tarefa funciona');

  // Histórico retornado pela Function não pode ser alterado ou apagado diretamente.
  const historyDoc = doc(owner.firestore, 'warranty_updates', history.docs[0].id);
  await expectDeny('cliente não altera evento anterior do histórico', () =>
    updateDoc(historyDoc, { content: 'adulterado' }));
  await expectDeny('cliente não apaga evento anterior do histórico', () =>
    deleteDoc(historyDoc));
  await expectDeny('cliente não fabrica um registro reservado da lixeira', () =>
    addDoc(collection(owner.firestore, 'warranty_updates'), {
      warranty_id: own.id,
      user_id: owner.employeeId,
      content: 'Garantia enviada para a lixeira.',
      created_at: serverTimestamp(),
    }));

  // Bloqueios diretos pelas Firestore Rules (não apenas UI).
  await expectDeny('cliente não escreve deleted_at diretamente', () =>
    updateDoc(doc(owner.firestore, 'warranty_claims', own.id), { deleted_at: new Date() }));
  await expectDeny('cliente não altera autoria', () =>
    updateDoc(doc(owner.firestore, 'warranty_claims', own.id), { requested_by: colleague.employeeId }));
  await expectDeny('cliente não arquiva tarefa de garantia diretamente', () =>
    updateDoc(doc(owner.firestore, 'tasks', own.taskIds[0]), { archived_at: new Date(), board_visible: false }));
  await expectDeny('cliente não exclui fisicamente tarefa de garantia', () =>
    deleteDoc(doc(owner.firestore, 'tasks', own.taskIds[0])));

  // QA: vínculos indevidos e metadados de histórico, sem dados reais.
  await expectDeny('colega não vincula tarefa à garantia de terceiro', () =>
    addDoc(collection(colleague.firestore, 'tasks'), {
      warranty_id: own.id, created_by: colleague.employeeId,
      sector: 'garantias', board_visible: true, assignee_id: 'emp-12',
      status: 'todo', priority: 'high',
    }));
  await expectDeny('autor não usa funcionário destinatário diferente', () =>
    addDoc(collection(owner.firestore, 'tasks'), {
      warranty_id: own.id, created_by: owner.employeeId,
      sector: 'garantias', board_visible: true, assignee_id: 'emp-999',
      status: 'todo', priority: 'high',
    }));
  await expectDeny('autor não cria tarefa vinculada pré-arquivada', () =>
    addDoc(collection(owner.firestore, 'tasks'), {
      warranty_id: own.id, created_by: owner.employeeId,
      sector: 'garantias', board_visible: true, assignee_id: 'emp-12',
      status: 'todo', priority: 'high', archived_at: serverTimestamp(),
    }));
  await expectDeny('autor não vincula tarefa a garantia inexistente', () =>
    addDoc(collection(owner.firestore, 'tasks'), {
      warranty_id: `qa_inexistente_${runId}`, created_by: owner.employeeId,
      sector: 'garantias', board_visible: true, assignee_id: 'emp-12',
      status: 'todo', priority: 'high',
    }));
  const forgedSite = await createClaim('qa-site-linked', owner.employeeId, { origin: 'site', tasks: 0 });
  await expectDeny('autor não cria tarefa de garantia originada pelo site', () =>
    addDoc(collection(owner.firestore, 'tasks'), {
      warranty_id: forgedSite.id, created_by: owner.employeeId,
      sector: 'garantias', board_visible: true, assignee_id: 'emp-12',
      status: 'todo', priority: 'high',
    }));
  await expectDeny('cliente não injeta campo system_event no histórico', () =>
    addDoc(collection(owner.firestore, 'warranty_updates'), {
      warranty_id: own.id, user_id: owner.employeeId,
      content: 'Nota comum', created_at: serverTimestamp(), system_event: true,
    }));
  await expectDeny('cliente não cria histórico para garantia inexistente', () =>
    addDoc(collection(owner.firestore, 'warranty_updates'), {
      warranty_id: `qa_inexistente_${runId}`, user_id: owner.employeeId,
      content: 'Nota comum', created_at: serverTimestamp(),
    }));
  const note = await addDoc(collection(owner.firestore, 'warranty_updates'), {
    warranty_id: own.id, user_id: owner.employeeId,
    content: 'Nota de acompanhamento fictícia',
    attachment_url: null, attachment_name: null,
    created_at: serverTimestamp(),
  });
  assert((await db.doc(`warranty_updates/${note.id}`).get()).exists);
  log('nota legítima do funcionário continua permitida');

  // Site: apenas administrador, TI ou funcionário com setor Site.
  const siteClaim = await createClaim('site-claim', 'site', { origin: 'site', tasks: 1 });
  await expectDeny('Estoque e Expedição sem Site não excluem site', () => expedition.manage(siteClaim.id, 'delete'));
  await expectDeny('autor comum não exclui site', () => owner.manage(siteClaim.id, 'delete'));
  assert.equal((await site.manage(siteClaim.id, 'delete')).data.archivedTasks, 1);
  assert.equal((await site.manage(siteClaim.id, 'restore')).data.restoredTasks, 1);
  log('setor Site exclui e restaura solicitação do site');
  assert.equal((await admin.manage(siteClaim.id, 'delete')).data.archivedTasks, 1);
  assert.equal((await ti.manage(siteClaim.id, 'restore')).data.restoredTasks, 1);
  log('admin e TI podem gerenciar solicitações do site');

  // Setor Site não obtém permissão indiscriminada para garantias manuais de colegas.
  const someoneElses = await createClaim('colleague-own', colleague.employeeId, { tasks: 0 });
  await expectDeny('setor Site não exclui garantia manual de colega', () => site.manage(someoneElses.id, 'delete'));
  assert.equal((await admin.manage(someoneElses.id, 'delete')).data.archivedTasks, 0);
  log('admin exclui garantia manual de terceiro sem tarefa');

  // Permissão explícita do módulo e ausência de módulo.
  const explicitOwn = await createClaim('explicit-own', explicit.employeeId, { tasks: 0 });
  assert.equal((await explicit.manage(explicitOwn.id, 'delete')).data.archivedTasks, 0);
  log('permissão explícita do módulo autoriza exclusão própria');
  const noModuleOwn = await createClaim('no-module-own', withoutModule.employeeId, { tasks: 0 });
  await expectDeny('funcionário sem módulo não exclui nem a própria', () => withoutModule.manage(noModuleOwn.id, 'delete'));

  console.log(`\nPASS INTEGRAÇÃO: ${checks} verificações, operações reais nos emuladores.`);
}

main().catch(error => { console.error(`\nFALHA NA INTEGRAÇÃO: ${bad(error)}`); process.exitCode = 1; })
  .finally(async () => {
    await Promise.allSettled(apps.map(app => deleteApp(app)));
    await firebaseAdmin.app().delete();
  });
