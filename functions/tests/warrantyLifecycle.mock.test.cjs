'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

class FakeHttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const DELETE = Symbol('delete-field');
const at = iso => ({ iso, isEqual(other) { return other?.iso === iso; } });

function scenario({ sectors = ['garantias'], role = 'employee', origin = '', owner = 'emp-1', action = 'delete',
  actorId = 'emp-1', loggedIn = true, deleted = false, inactive = false, feature = null, taskValues = [] } = {}) {
  const user = { active: !inactive, sectors };
  const claim = { requested_by: owner, origin, ...(deleted ? { deleted_at: at('2026-10-29') } : {}) };
  const records = {
    'auth_links/uid-1': { user_id: actorId, role, active: true },
    [`users/${actorId}`]: user,
    [`user_feature_permissions/tracking_warranties__${actorId}`]: feature,
    'warranty_claims/claim-123': claim,
  };
  const tasks = taskValues.map((value, i) => ({ ref: { path: `tasks/task-${i}` }, data() { return value; } }));
  const writes = [];
  const query = { kind: 'task-query' };
  const db = {
    doc(path) { return { path }; },
    collection(name) {
      if (name === 'tasks') return { where(field, op, value) {
        assert.equal(field, 'warranty_id'); assert.equal(op, '=='); assert.equal(value, 'claim-123'); return query;
      } };
      if (name === 'warranty_updates') return { doc() { return { path: 'warranty_updates/new' }; } };
      throw new Error('Coleção inesperada');
    },
    async runTransaction(callback) {
      const tx = {
        async get(ref) {
          if (ref === query) return { docs: tasks, size: tasks.length };
          if (!Object.hasOwn(records, ref.path) || !records[ref.path]) return { exists: false, data() { return undefined; } };
          return { exists: true, data() { return records[ref.path]; } };
        },
        update(ref, data) { writes.push({ kind: 'update', path: ref.path, data }); },
        create(ref, data) { writes.push({ kind: 'create', path: ref.path, data }); },
      };
      return callback(tx);
    },
  };
  const oldLoad = Module._load;
  Module._load = function (id, parent, main) {
    if (id === 'firebase-functions/v2/https') return { HttpsError: FakeHttpsError, onCall: (_, callback) => callback };
    if (id === 'firebase-admin/firestore') return {
      getFirestore: () => db,
      Timestamp: { now: () => at('2026-10-29T15:00:00Z') },
      FieldValue: { delete: () => DELETE },
    };
    return oldLoad.call(this, id, parent, main);
  };
  const filename = require.resolve('../warrantyLifecycle.cjs');
  delete require.cache[filename];
  let handler;
  try { handler = require('../warrantyLifecycle.cjs').manageWarrantyLifecycle; }
  finally { Module._load = oldLoad; delete require.cache[filename]; }
  return {
    writes, DELETE, actorId,
    run: () => handler({ auth: loggedIn ? { uid: 'uid-1' } : undefined, data: { warrantyId: 'claim-123', action, userId: 'forged-admin' } }),
  };
}

test('exclui garantia própria e arquiva tarefas na mesma transação', async () => {
  const s = scenario({ taskValues: [
    { warranty_id: 'claim-123', board_visible: true },
    { warranty_id: 'claim-123', archived_at: at('old-date') },
  ] });
  assert.deepEqual(await s.run(), { archivedTasks: 1 });
  assert.equal(s.writes.length, 3);
  assert.equal(s.writes[0].path, 'warranty_claims/claim-123');
  assert.equal(s.writes[0].data.deleted_by, 'emp-1');
  assert.equal(s.writes[1].path, 'tasks/task-0');
  assert.equal(s.writes[1].data.warranty_archived_by_deletion, 'claim-123');
  assert.equal(s.writes[2].data.content, 'Garantia enviada para a lixeira.');
});
test('restaura somente arquivamentos da exclusão original', async () => {
  const s = scenario({ action: 'restore', deleted: true, taskValues: [
    { warranty_id: 'claim-123', warranty_archived_by_deletion: 'claim-123', archived_at: at('2026-10-29'), warranty_previous_board_visible: true },
    { warranty_id: 'claim-123', warranty_archived_by_deletion: 'claim-123', archived_at: at('other-time') },
  ] });
  assert.deepEqual(await s.run(), { restoredTasks: 1 });
  assert.equal(s.writes.length, 3);
  assert.equal(s.writes[0].data.deleted_at, s.DELETE);
  assert.equal(s.writes[1].data.archived_at, s.DELETE);
  assert.equal(s.writes[1].data.board_visible, true);
});
test('funcionário de Site gerencia pedido do Site', async () => {
  const s = scenario({ origin: 'site', owner: 'site', sectors: ['site','estoque'] });
  assert.deepEqual(await s.run(), { archivedTasks: 0 });
});
test('Expedição sem Site é negada para garantia do Site', async () => {
  const s = scenario({ origin: 'site', owner: 'site', sectors: ['expedicao'] });
  await assert.rejects(s.run(), e => e.code === 'permission-denied');
  assert.equal(s.writes.length, 0);
});
test('não permite garantia de outro funcionário', async () => {
  const s = scenario({ owner: 'emp-2' });
  await assert.rejects(s.run(), e => e.code === 'permission-denied');
  assert.equal(s.writes.length, 0);
});
test('solicitação forjada com userId admin não altera autor da operação', async () => {
  const s = scenario({ owner: 'emp-1' });
  await s.run();
  assert.equal(s.writes[0].data.deleted_by, 'emp-1');
});
test('usuário inativo é negado', async () => {
  const s = scenario({ inactive: true });
  await assert.rejects(s.run(), e => e.code === 'permission-denied');
  assert.equal(s.writes.length, 0);
});
test('exclusão duplicada é rejeitada', async () => {
  const s = scenario({ deleted: true });
  await assert.rejects(s.run(), e => e.code === 'failed-precondition');
});
test('restauração de garantia ativa é rejeitada', async () => {
  const s = scenario({ action: 'restore' });
  await assert.rejects(s.run(), e => e.code === 'failed-precondition');
});
test('requisição sem login é negada', async () => {
  const s = scenario({ loggedIn: false });
  await assert.rejects(s.run(), e => e.code === 'unauthenticated');
});
