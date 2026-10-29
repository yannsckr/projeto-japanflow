"use strict";

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { checkPermission } = require('./warrantyLifecyclePolicy.cjs');
const db = getFirestore();

const invalid = (message) => new HttpsError('invalid-argument', message);
const denied = () => new HttpsError('permission-denied', 'Sem permissão para esta garantia.');

// Admin SDK é usado intencionalmente. A segurança depende da autenticação
// e da verificação server-side abaixo, nunca de dados de usuário enviados pelo navegador.
exports.manageWarrantyLifecycle = onCall({
  region: 'southamerica-east1',
  enforceAppCheck: false,
  maxInstances: 5,
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login necessário.');
  const data = request.data ?? {};
  const id = data.warrantyId;
  const action = data.action;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) {
    throw invalid('Identificador de garantia inválido.');
  }
  if (action !== 'delete' && action !== 'restore') throw invalid('Ação inválida.');

  try {
    return await db.runTransaction(async (tx) => {
      const linkSnap = await tx.get(db.doc(`auth_links/${request.auth.uid}`));
      const link = linkSnap.data();
      if (!link || link.active === false || typeof link.user_id !== 'string' || !link.user_id) throw denied();

      const userId = link.user_id;
      const userSnap = await tx.get(db.doc(`users/${userId}`));
      const featureSnap = await tx.get(db.doc(`user_feature_permissions/tracking_warranties__${userId}`));
      const claimRef = db.doc(`warranty_claims/${id}`);
      const claimSnap = await tx.get(claimRef);
      if (!claimSnap.exists) throw new HttpsError('not-found', 'Garantia não encontrada.');
      const claim = claimSnap.data();

      if (!checkPermission({ link, user: userSnap.data(), feature: featureSnap.data() }, claim)) {
        throw denied();
      }
      const deleted = claim.deleted_at != null;
      if (action === 'delete' && deleted) throw new HttpsError('failed-precondition', 'Garantia já está na lixeira.');
      if (action === 'restore' && !deleted) throw new HttpsError('failed-precondition', 'Garantia não está na lixeira.');

      // Esta consulta também participa da transação. Não dependemos de
      // listagem feita antes dela no navegador.
      const linked = await tx.get(db.collection('tasks').where('warranty_id', '==', id));
      if (linked.size > 100) throw new HttpsError('failed-precondition', 'Quantidade inesperada de tarefas vinculadas.');
      const now = Timestamp.now();
      const historyRef = db.collection('warranty_updates').doc();
      let affectedTasks = 0;

      if (action === 'delete') {
        tx.update(claimRef, { deleted_at: now, deleted_by: userId, updated_at: now });
        for (const task of linked.docs) {
          const value = task.data();
          if (value.warranty_id !== id || value.archived_at || value.archivedAt) continue;
          tx.update(task.ref, {
            archived_at: now,
            archived_by: userId,
            board_visible: false,
            warranty_archived_by_deletion: id,
            warranty_previous_board_visible: value.board_visible !== false,
            updated_at: now,
          });
          affectedTasks++;
        }
      } else {
        tx.update(claimRef, {
          deleted_at: FieldValue.delete(),
          deleted_by: FieldValue.delete(),
          updated_at: now,
        });
        for (const task of linked.docs) {
          const value = task.data();
          if (value.warranty_id !== id || value.warranty_archived_by_deletion !== id) continue;
          const time = value.archived_at;
          if (!time || typeof time.isEqual !== 'function' || !time.isEqual(claim.deleted_at)) continue;
          tx.update(task.ref, {
            archived_at: FieldValue.delete(),
            archived_by: FieldValue.delete(),
            board_visible: value.warranty_previous_board_visible !== false,
            warranty_archived_by_deletion: FieldValue.delete(),
            warranty_previous_board_visible: FieldValue.delete(),
            updated_at: now,
          });
          affectedTasks++;
        }
      }
      tx.create(historyRef, {
        warranty_id: id,
        user_id: userId,
        content: action === 'delete' ? 'Garantia enviada para a lixeira.' : 'Garantia restaurada da lixeira.',
        attachment_url: null,
        attachment_name: null,
        created_at: now,
      });
      return action === 'delete' ? { archivedTasks: affectedTasks } : { restoredTasks: affectedTasks };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[Garantias] Erro na operação', { action, code: error?.code || 'unknown' });
    throw new HttpsError('internal', 'Não foi possível concluir a operação de garantia.');
  }
});
