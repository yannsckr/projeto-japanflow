import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');
function change(s, oldText, newText, label) {
  if (!s.includes(oldText))
    throw Error(
      `Padrão não encontrado (${label}); nenhum arquivo foi alterado. Verifique versão local.`
    );
  return s.replace(oldText, newText);
}
const fpath = 'src/components/ScheduledTasksManager.tsx',
  spath = 'cloud-run/server.js',
  util = 'cloud-run/schedule-utils.js';
let f = read(fpath),
  s = read(spath),
  u = read(util);
if (
  f.includes('next_run_at: nextRunAt') ||
  s.includes('next_run_at', s.indexOf('async function processScheduledTasks()'))
)
  throw Error('Parece já aplicado. Não repetir.');
// UI: Luxon disponível após instalação explícita npm install luxon e npm install -D @types/luxon.
f = change(
  f,
  "import { db } from '@/lib/firebase';",
  "import { db } from '@/lib/firebase';\nimport { DateTime } from 'luxon';",
  'import UI'
);
f = change(
  f,
  '  last_created_at: string | null;',
  '  last_created_at: string | null;\n  last_occurrence_key?: string | null;',
  'interface'
);
f = change(
  f,
  '            last_created_at: toIso(data.last_created_at),',
  '            last_created_at: toIso(data.last_created_at),\n            last_occurrence_key: data.last_occurrence_key || null,',
  'snapshot'
);
const fn = `// Usa horário civil de São Paulo; Dom=0 ... Sáb=6.\n// Não retoma uma ocorrência de um dia já marcado como criado.\nconst nextRunAtForForm = (schedule: {\n  schedule_time: string; recurrence: string; days_of_week: number[];\n  active?: boolean; last_occurrence_key?: string | null;\n}): Timestamp | null => {\n  if (schedule.active === false) return null;\n  if (!/^([01]\\d|2[0-3]):[0-5]$/.test(schedule.schedule_time)) return null;\n  if (schedule.recurrence === 'specific_days' && !schedule.days_of_week.length) return null;\n  const now = DateTime.now().setZone('America/Sao_Paulo');\n  const [hour, minute] = schedule.schedule_time.split(':').map(Number);\n  for (let offset = 0; offset <= 7; offset++) {\n    const day = now.startOf('day').plus({ days: offset });\n    if (schedule.recurrence === 'specific_days' && !schedule.days_of_week.includes(day.weekday % 7)) continue;\n    if (day.toFormat('yyyy-LL-dd') === schedule.last_occurrence_key) continue;\n    const run = day.set({ hour, minute });\n    if (run.isValid) return Timestamp.fromDate(run.toJSDate());\n  }\n  return null;\n};\n\n`;
f = change(
  f,
  'const ScheduledTasksManager = () => {',
  fn + 'const ScheduledTasksManager = () => {',
  'UI helper'
);
f = change(
  f,
  '    try {\n      if (editingId) {',
  `    const existing = schedules.find((item) => item.id === editingId);\n    const nextRunAt = nextRunAtForForm({\n      ...payload, active: existing?.active ?? true,\n      last_occurrence_key: existing?.last_occurrence_key ?? null,\n    });\n\n    try {\n      if (editingId) {`,
  'save start'
);
f = change(
  f,
  "await updateDoc(doc(db, 'scheduled_tasks', editingId), payload);",
  "await updateDoc(doc(db, 'scheduled_tasks', editingId), { ...payload, next_run_at: nextRunAt });",
  'save edit'
);
f = change(
  f,
  '          ...payload,\n\n          active: true,',
  '          ...payload,\n          next_run_at: nextRunAt,\n\n          active: true,',
  'save create'
);
f = change(
  f,
  "      await updateDoc(doc(db, 'scheduled_tasks', id), {\n        active: !active,",
  "      const schedule = schedules.find((item) => item.id === id);\n      if (!schedule) throw new Error('Agendamento não encontrado');\n      await updateDoc(doc(db, 'scheduled_tasks', id), {\n        active: !active,\n        next_run_at: nextRunAtForForm({ ...schedule, active: !active }),",
  'toggle'
);
// Cloud Run: roll forward scheduleRef state after each due job. For safe activation use backend opt-in env until backfill done.
s = change(
  s,
  "import { DateTime } from 'luxon';",
  "import { DateTime } from 'luxon';\nimport { calculateNextRunAt } from './schedule-utils.js';",
  'server import'
);
s = change(
  s,
  '      last_occurrence_key: localDate,\n      updated_at: FieldValue.serverTimestamp(),',
  '      last_occurrence_key: localDate,\n      next_run_at: calculateNextRunAt({ ...schedule, last_occurrence_key: localDate }),\n      updated_at: FieldValue.serverTimestamp(),',
  'advance next'
);
const original =
  "  const schedulesSnapshot = await db.collection('scheduled_tasks').get();\n  const clock = saoPauloClock();";
const replacement = `  // Ative SÓ depois de backfill da produção e deploy do frontend.\n  const optimized = process.env.NEXT_RUN_QUERY_ENABLED === 'true';\n  const now = new Date();\n  const schedulesSnapshot = optimized\n    ? await db.collection('scheduled_tasks')\n        .where('next_run_at', '<=', now)\n        .limit(200)\n        .get()\n    : await db.collection('scheduled_tasks').get();\n  const clock = saoPauloClock();`;
s = change(s, original, replacement, 'query');
// Restore schedule reliability: avoid suppressing operational tasks based on usage metrics.
s = change(
  s,
  "    if (guardMode === 'protected') {\n      console.warn('scheduled-tasks skipped by Cost Guard');\n      return json(res, 200, { ok: true, skippedByCostGuard: true, guardMode });\n    }",
  "    // Tarefas essenciais continuam mesmo em protected; consulta otimizada reduz leituras.\n    if (guardMode === 'protected') console.warn('Cost Guard protected: scheduler essencial mantido');",
  'protected'
);
// Ensure record with next_run_at but no due for today catches stale timestamps; once recalculated.
write(fpath, f);
write(spath, s);
console.log('OK: alterações feitas no frontend e Cloud Run.');
console.log(
  'Flag NEXT_RUN_QUERY_ENABLED ausente ou false mantém a consulta antiga até o backfill.'
);
