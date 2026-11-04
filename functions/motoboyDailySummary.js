'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { buildDailySummary, daySaoPaulo } = require('./motoboyDailySummaryCore.cjs');

// Snapshot at 18h Sao Paulo time, not an end-of-day reconciliation.
exports.motoboyDailySummary = onSchedule({
  schedule: '0 18 * * *', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1',
}, async () => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const day = daySaoPaulo(new Date());
  const [pointsSnapshot, assignmentsSnapshot] = await Promise.all([
    db.collection('motoboy_telemetry').where('day', '==', day).get(),
    db.collection('motoboy_assignments').get(),
  ]);
  const assignments = assignmentsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  const points = pointsSnapshot.docs.map((snapshot) => snapshot.data());
  const users = buildDailySummary(day, assignments, points);
  await db.collection('motoboy_daily_reports').doc(day).set({
    day,
    users,
    generated_at: admin.firestore.FieldValue.serverTimestamp(),
    note: 'Retrato das 18h: somente corridas concluidas ate o momento. Distancia estimada a partir de amostras GPS validas, sem confiar em metros enviados pelo cliente.',
  });
});
