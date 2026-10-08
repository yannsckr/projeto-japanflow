import { Firestore, Timestamp } from '@google-cloud/firestore';
import { calculateNextRunAt } from './schedule-utils.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectIndex = args.indexOf('--project');
const projectId = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
if (!projectId || !/^[a-z][a-z0-9-]+$/.test(projectId)) {
  throw new Error('Informe --project demo-japanflow-qa (ou o projeto pretendido).');
}
if (apply && !args.includes(`--confirm=${projectId}`)) {
  throw new Error(`Aplicação bloqueada: inclua --confirm=${projectId}`);
}
if (projectId === 'japanflow-erp' && apply && !args.includes('--production-approved')) {
  throw new Error('Produção bloqueada: inclua --production-approved após revisar o dry-run.');
}
if (process.env.FIRESTORE_EMULATOR_HOST && projectId === 'japanflow-erp') {
  throw new Error('Projeto de produção não pode ser combinado com emulador.');
}
const db = new Firestore({ projectId });
const snapshot = await db.collection('scheduled_tasks').get();
console.log(`${apply ? 'APLICANDO' : 'PREVISUALIZAÇÃO'}: ${snapshot.size} agendamentos em ${projectId}`);
let changed = 0;
let skipped = 0;
for (const record of snapshot.docs) {
  const data = record.data();
  const nextDate = calculateNextRunAt(data);
  const expectedMs = nextDate?.getTime() ?? null;
  const actualValue = data.next_run_at;
  const actualMs = actualValue?.toDate?.()?.getTime() ?? null;
  if (expectedMs === actualMs) { skipped++; continue; }
  const display = nextDate ? nextDate.toISOString() : 'null (inativo/inválido)';
  console.log(`${record.id}: ${display}`);
  if (apply) {
    await record.ref.update({ next_run_at: nextDate ? Timestamp.fromDate(nextDate) : null });
  }
  changed++;
}
console.log(JSON.stringify({ projectId, apply, total: snapshot.size, changed, skipped }, null, 2));
