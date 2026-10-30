'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
if (!getApps().length) initializeApp();
const db = getFirestore();

const safeIds = (input, label) => {
  if (!Array.isArray(input) || input.length > 20 || input.some(x => typeof x !== 'string' || !x || x.length > 180)) {
    throw new HttpsError('invalid-argument', `${label}: máximo de 20 IDs válidos`);
  }
  return [...new Set(input)];
};

// Consulta de contagem é executada com Admin SDK, nunca com credenciais do navegador.
exports.getChatUnreadCounts = onCall({ region: 'southamerica-east1', enforceAppCheck: false, maxInstances: 5, timeoutSeconds: 60 }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login necessário');
  const uid = request.auth.uid;
  const link = await db.doc(`auth_links/${uid}`).get();
  const linkData = link.data();
  if (!link.exists || !linkData?.user_id || linkData.active === false) throw new HttpsError('permission-denied', 'Usuário sem vínculo ativo');
  const userId = linkData.user_id;
  const user = await db.doc(`users/${userId}`).get();
  if (!user.exists || user.data()?.active === false) throw new HttpsError('permission-denied', 'Usuário inativo');
  const partnerIds = safeIds(request.data?.partnerIds ?? [], 'partnerIds');
  const groupIds = safeIds(request.data?.groupIds ?? [], 'groupIds');

  const privateBase = db.collection('messages').where('receiverId', '==', userId).where('read', '==', false).where('deleted', '==', false);
  const privateTotal = (await privateBase.count().get()).data().count;
  const privateByPartner = {};
  // Nunca aceite o userId vindo do cliente; todos os filtros são vinculados ao login.
  await Promise.all(partnerIds.map(async partnerId => {
    privateByPartner[partnerId] = (await privateBase.where('senderId', '==', partnerId).count().get()).data().count;
  }));

  const groupById = {};
  await Promise.all(groupIds.map(async groupId => {
    const group = await db.doc(`custom_groups/${groupId}`).get();
    if (!group.exists || !Array.isArray(group.data()?.participant_ids) || !group.data().participant_ids.includes(userId)) {
      // Não revele a existência de grupos sem autorização.
      throw new HttpsError('permission-denied', 'Grupo não autorizado');
    }
    const read = await db.doc(`chat_read_status/${userId}__group__${groupId}`).get();
    let q = db.collection('group_messages')
      .where('group_id', '==', groupId)
      .where('deleted', '==', false)
      .where('sender_id', '!=', userId);
    const readTime = read.data()?.last_read_at;
    if (readTime) q = q.where('created_at', '>', readTime);
    groupById[groupId] = (await q.count().get()).data().count;
  }));
  return { privateTotal, privateByPartner, groupById };
});

// Disabled until the site intake gates are approved.
exports.receiveSiteWarranty = require('./siteWarrantyFirebase.cjs').receiveSiteWarranty;
exports.manageWarrantyLifecycle = require('./warrantyLifecycle.cjs').manageWarrantyLifecycle;

exports.motoboyDailySummary = require('./motoboyDailySummary').motoboyDailySummary;
