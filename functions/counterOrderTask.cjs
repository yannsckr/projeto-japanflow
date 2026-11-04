'use strict';

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

// Preferência: UID funcional configurado em system_settings/counter_order_automation.assignee_user_id.
// Sem configuração, somente aceita uma correspondência inequívoca por nome/username Jonathan.
function selectJonathan(users) {
  const matches = users.filter(({ data }) => {
    if (!data || data.active === false) return false;
    const name = String(data.name || '').trim();
    const username = String(data.username || '').trim();
    return /^jonathan(?:\s|$)/i.test(name) || /^jonathan(?:[._-]|$)/i.test(username);
  });
  return matches.length === 1 ? matches[0].id : null;
}

function taskFromCounterOrder(orderId, order, assigneeId) {
  const item = String(order.item_name || '').slice(0, 160);
  const lines = [
    `Encomenda Balcão #${orderId}`,
    `Item: ${item}`,
    `Código: ${order.code || 'Não informado'}`,
    `Aplicação: ${order.application || 'Não informada'}`,
    `Quantidade: ${order.quantity || 1}`,
    `Marca: ${order.brand || 'Não informada'}`,
    `Fornecedor: ${order.supplier || 'Não informado'}`,
    `Prazo: ${order.deadline || 'Não informado'}`,
    `Cliente (ID): ${order.client_id || 'Não informado'}`,
    `Solicitante: ${order.created_by_name || 'Não informado'}`,
    `Link: ${order.link || 'Não informado'}`,
  ];
  const now = new Date().toISOString();
  return {
    title: `Realizar encomenda: ${item}`,
    description: lines.join('\n').slice(0, 5000),
    status: 'todo',
    priority: 'high',
    assignee_id: assigneeId,
    assignee_ids: [assigneeId],
    created_by: String(order.created_by_id || 'system'),
    deadline: String(order.deadline || ''),
    sector: null,
    image_url: null,
    image_urls: [],
    response: null,
    status_history: [{ status: 'todo', enteredAt: now }],
    board_visible: true,
    counter_order_id: orderId,
    origin: 'counter_order_automation',
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

const createCounterOrderTask = onDocumentCreated(
  { document: 'counter_orders/{orderId}', region: 'southamerica-east1', maxInstances: 5, retry: false },
  async (event) => {
    const order = event.data?.data();
    const orderId = event.params.orderId;
    if (!order || !order.item_name) return;
    const db = getFirestore();
    const taskRef = db.collection('tasks').doc(`counter_order_${orderId}`);
    if ((await taskRef.get()).exists) return;

    const config = await db.doc('system_settings/counter_order_automation').get();
    let assigneeId = config.data()?.assignee_user_id;
    if (typeof assigneeId === 'string' && assigneeId.length) {
      const user = await db.doc(`users/${assigneeId}`).get();
      if (!user.exists || user.data()?.active === false) {
        await db.collection('counter_orders').doc(orderId).update({ task_automation_status: 'assignee_inactive' });
        console.error('Destino da automação está ausente ou inativo', { orderId });
        return;
      }
    } else {
      const snapshot = await db.collection('users').get();
      assigneeId = selectJonathan(snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })));
      if (!assigneeId) {
        await db.collection('counter_orders').doc(orderId).update({ task_automation_status: 'assignee_ambiguous' });
        console.error('Jonathan não identificado de maneira única; configure assignee_user_id', { orderId });
        return;
      }
    }
    // create é atômico e impede duplicação em reentregas do evento.
    try {
      await taskRef.create(taskFromCounterOrder(orderId, order, assigneeId));
      await db.collection('counter_orders').doc(orderId).update({ task_automation_status: 'created', task_id: taskRef.id });
    } catch (error) {
      if (error.code === 6 || error.code === 'already-exists') return;
      throw error;
    }
  }
);

module.exports = { createCounterOrderTask, selectJonathan, taskFromCounterOrder };
