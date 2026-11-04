'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Carrega apenas funções puras com stubs; testes não acessam Firebase real.
function loadWithStubs(filename, mocks) {
  const file = path.join(__dirname, '..', filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module,
    exports: module.exports,
    require: (name) => mocks[name] || require(name),
    console,
    process,
  }, { filename: file });
  return module.exports;
}
const dbStub = { FieldValue: { serverTimestamp: () => 'SERVER_TIME' } };
const appStub = { getApps: () => [{}], initializeApp: () => {} };
const logic = loadWithStubs('counterOrderTask.cjs', {
  'firebase-functions/v2/firestore': { onDocumentCreated: (_opt, fn) => fn },
  'firebase-admin/app': appStub,
  'firebase-admin/firestore': { getFirestore: () => ({}), ...dbStub },
});
const deletion = loadWithStubs('referenceDiagramDeletion.cjs', {
  'firebase-functions/v2/https': { onCall: (_opt, fn) => fn, HttpsError: class extends Error {} },
  'firebase-admin/app': appStub,
  'firebase-admin/firestore': { getFirestore: () => ({}), ...dbStub },
  'firebase-admin/storage': { getStorage: () => ({}) },
});

test('resolve Jonathan somente quando houver destino único ativo', () => {
  assert.equal(logic.selectJonathan([{ id: 'u1', data: { name: 'Jonathan Silva', active: true } }]), 'u1');
  assert.equal(logic.selectJonathan([{ id: 'u1', data: { name: 'Jonathan Silva' } }, { id: 'u2', data: { username: 'jonathan', active: true } }]), null);
  assert.equal(logic.selectJonathan([{ id: 'u1', data: { name: 'Jonathan', active: false } }]), null);
  assert.equal(logic.selectJonathan([{ id: 'u1', data: { name: 'John', active: true } }]), null);
});

test('a tarefa carrega origem, responsável, dados da encomenda e status', () => {
  const t = logic.taskFromCounterOrder('order001', { item_name: 'Bucha de coxim', quantity: 2, code: 'ABC', created_by_id: 'paloma' }, 'jonathan-id');
  assert.equal(t.assignee_id, 'jonathan-id');
  assert.equal(t.origin, 'counter_order_automation');
  assert.equal(t.counter_order_id, 'order001');
  assert.equal(t.status, 'todo');
  assert.equal(t.board_visible, true);
  assert.match(t.description, /Quantidade: 2/);
});

test('bloqueia caminhos indevidos na exclusão do diagrama', () => {
  assert.equal(deletion.validDiagramImagePath('reference_diagrams/admin-001/abc_123.png'), true);
  for (const path of ['reference_diagrams/a/../../secret.png', 'attachments/a.png', 'reference_diagrams/a/malware.exe', 'reference_diagrams/a/x.png/child']) {
    assert.equal(deletion.validDiagramImagePath(path), false);
  }
});
