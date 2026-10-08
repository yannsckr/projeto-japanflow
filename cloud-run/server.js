import http from 'node:http';
import { Firestore, FieldValue } from '@google-cloud/firestore';
import monitoring from '@google-cloud/monitoring';
import { DateTime } from 'luxon';
import { calculateNextRunAt } from './schedule-utils.js';
const port = Number(process.env.PORT || 8080);
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'japanflow-erp';
const db = new Firestore();
const monitoringClient = new monitoring.MetricServiceClient();
function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function decodePubSub(body) {
  const encoded = body?.message?.data;
  if (!encoded) {
    throw new Error('Pub/Sub message.data ausente');
  }
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}
async function findRecipients() {
  const recipients = new Map();
  const ryan = await db.collection('users').where('username', '==', 'ryan').get();
  ryan.forEach((doc) => {
    recipients.set(doc.id, doc.data());
  });
  const ti = await db.collection('users').where('sectors', 'array-contains', 'ti').get();
  ti.forEach((doc) => {
    recipients.set(doc.id, doc.data());
  });
  return [...recipients.entries()];
}
function severityFromPercentage(percentage) {
  if (percentage >= 0.9) return 'critical';
  if (percentage >= 0.75) return 'warning';
  if (percentage >= 0.5) return 'attention';
  return 'info';
}
function billingTitle(percentage) {
  if (percentage >= 100) {
    return 'Limite de orçamento atingido';
  }
  if (percentage <= 1) {
    return 'JapanFlow começou a gerar custo';
  }
  return `Orçamento Google em ${percentage}%`;
}
function billingMessage(percentage, cost, budgetAmount) {
  if (percentage <= 1) {
    return (
      'O Google Cloud começou a registrar cobrança no JapanFlow. ' +
      `Uso aproximado: R$ ${cost.toFixed(2)} de R$ ${budgetAmount.toFixed(2)}.`
    );
  }
  if (percentage >= 100) {
    return (
      `O orçamento operacional de R$ ${budgetAmount.toFixed(2)} foi atingido. ` +
      `Custo aproximado atual: R$ ${cost.toFixed(2)}.`
    );
  }
  return `Uso aproximado: R$ ${cost.toFixed(2)} de R$ ${budgetAmount.toFixed(2)}.`;
}
async function handleBudgetAlert(req, res) {
  try {
    const envelope = await readBody(req);
    const budget = decodePubSub(envelope);
    const threshold = Number(budget.alertThresholdExceeded || 0);
    const cost = Number(budget.costAmount || 0);
    const budgetAmount = Number(budget.budgetAmount || 100);
    const percentage = Math.round(threshold * 100);
    if (!percentage) {
      return json(res, 204, {});
    }
    const recipients = await findRecipients();
    if (!recipients.length) {
      console.warn('budget-alert: nenhum destinatário encontrado');
      return json(res, 200, {
        ok: true,
        percentage,
        recipients: 0,
      });
    }
    const batch = db.batch();
    for (const [userId] of recipients) {
      const ref = db.collection('system_notifications').doc();
      batch.set(ref, {
        recipient_user_id: userId,
        type: 'billing_budget',
        source: 'google-cloud',
        title: billingTitle(percentage),
        message: billingMessage(percentage, cost, budgetAmount),
        severity: severityFromPercentage(threshold),
        budget_percentage: percentage,
        cost_amount: cost,
        budget_amount: budgetAmount,
        currency: budget.currencyCode || 'BRL',
        budget_name: budget.budgetDisplayName || 'JapanFlow',
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log('budget-alert', {
      percentage,
      threshold,
      cost,
      budgetAmount,
      recipients: recipients.length,
    });
    return json(res, 200, {
      ok: true,
      percentage,
      recipients: recipients.length,
    });
  } catch (error) {
    console.error('budget-alert', error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
const FREE_TIER_METRICS = [
  {
    key: 'reads',
    label: 'leituras',
    metricType: 'firestore.googleapis.com/document/read_ops_count',
    limit: 50000,
  },
  {
    key: 'writes',
    label: 'gravações',
    metricType: 'firestore.googleapis.com/document/write_count',
    limit: 20000,
  },
  {
    key: 'deletes',
    label: 'exclusões',
    metricType: 'firestore.googleapis.com/document/delete_ops_count',
    limit: 20000,
  },
];
const FREE_TIER_THRESHOLDS = [70, 85, 95, 100];
function costGuardMode(percentage) {
  if (percentage >= 95) return 'protected';
  if (percentage >= 85) return 'economy';
  if (percentage >= 70) return 'warning';
  return 'normal';
}
function getPacificDayWindow() {
  const now = DateTime.now().setZone('America/Los_Angeles');
  const start = now.startOf('day');
  return {
    dayKey: now.toFormat('yyyy-LL-dd'),
    start: start.toUTC(),
    end: now.toUTC(),
  };
}
function pointNumericValue(point) {
  const value = point?.value;
  if (!value) return 0;
  if (value.int64Value !== undefined && value.int64Value !== null) {
    return Number(value.int64Value);
  }
  if (value.doubleValue !== undefined && value.doubleValue !== null) {
    return Number(value.doubleValue);
  }
  return 0;
}
async function readMetricUsage(metricType, start, end) {
  const name = monitoringClient.projectPath(projectId);
  const [timeSeries] = await monitoringClient.listTimeSeries({
    name,
    filter: `metric.type="${metricType}"`,
    interval: {
      startTime: {
        seconds: Math.floor(start.toMillis() / 1000),
      },
      endTime: {
        seconds: Math.floor(end.toMillis() / 1000),
      },
    },
    view: 'FULL',
  });
  let total = 0;
  for (const series of timeSeries) {
    for (const point of series.points || []) {
      total += pointNumericValue(point);
    }
  }
  return total;
}
function freeTierSeverity(percentage) {
  if (percentage >= 90) return 'critical';
  if (percentage >= 75) return 'warning';
  if (percentage >= 50) return 'attention';
  return 'info';
}
function thresholdReached(percentage) {
  return [...FREE_TIER_THRESHOLDS].reverse().find((threshold) => percentage >= threshold);
}
async function sendFreeTierNotifications({
  metric,
  usage,
  percentage,
  threshold,
  dayKey,
  recipients,
}) {
  const batch = db.batch();
  for (const [userId] of recipients) {
    const notificationId = ['free-tier', dayKey, metric.key, threshold, userId].join('-');
    const notificationRef = db.collection('system_notifications').doc(notificationId);
    const title =
      threshold >= 100
        ? `Volume diário de ${metric.label} acima da franquia`
        : `Firestore: ${threshold}% da franquia diária de ${metric.label}`;
    const message =
      `${usage.toLocaleString('pt-BR')} de ` +
      `${metric.limit.toLocaleString('pt-BR')} ${metric.label} da referência diária ` +
      `utilizadas hoje (${percentage.toFixed(1)}%).`;
    batch.set(
      notificationRef,
      {
        recipient_user_id: userId,
        type: 'firestore_free_tier',
        source: 'google-cloud-monitoring',
        metric: metric.key,
        title,
        message,
        severity: freeTierSeverity(threshold),
        quota_percentage: percentage,
        quota_threshold: threshold,
        quota_usage: usage,
        quota_limit: metric.limit,
        quota_day: dayKey,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      },
      {
        merge: false,
      }
    );
  }
  await batch.commit();
}
async function handleFreeTierMonitor(_req, res) {
  try {
    const { dayKey, start, end } = getPacificDayWindow();
    const recipients = await findRecipients();
    if (!recipients.length) {
      console.warn('free-tier-monitor: nenhum destinatário encontrado');
      return json(res, 200, {
        ok: true,
        recipients: 0,
      });
    }
    const results = [];
    for (const metric of FREE_TIER_METRICS) {
      const usage = await readMetricUsage(metric.metricType, start, end);
      const percentage = (usage / metric.limit) * 100;
      const reached = thresholdReached(percentage);
      const stateRef = db.collection('system_monitor_state').doc(`${dayKey}-${metric.key}`);
      const stateSnapshot = await stateRef.get();
      const previousThreshold = Number(stateSnapshot.data()?.highest_threshold || 0);
      if (reached && reached > previousThreshold) {
        const thresholdsToNotify = FREE_TIER_THRESHOLDS.filter(
          (threshold) => threshold > previousThreshold && threshold <= reached
        );
        for (const threshold of thresholdsToNotify) {
          await sendFreeTierNotifications({
            metric,
            usage,
            percentage,
            threshold,
            dayKey,
            recipients,
          });
        }
        await stateRef.set(
          {
            metric: metric.key,
            day: dayKey,
            highest_threshold: reached,
            usage,
            percentage,
            updated_at: FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      } else {
        await stateRef.set(
          {
            metric: metric.key,
            day: dayKey,
            highest_threshold: previousThreshold,
            usage,
            percentage,
            updated_at: FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      }
      results.push({
        metric: metric.key,
        usage,
        limit: metric.limit,
        percentage: Number(percentage.toFixed(2)),
        highestThreshold: reached || 0,
      });
    }
    const maxPercentage = Math.max(0, ...results.map((result) => Number(result.percentage || 0)));
    const guardMode = costGuardMode(maxPercentage);
    const reads = results.find((result) => result.metric === 'reads') || null;
    const writes = results.find((result) => result.metric === 'writes') || null;
    const deletes = results.find((result) => result.metric === 'deletes') || null;
    await db
      .collection('system_runtime')
      .doc('firestore_guard')
      .set(
        {
          mode: guardMode,
          day: dayKey,
          max_percentage: maxPercentage,
          reads_percentage: Number(reads?.percentage || 0),
          writes_percentage: Number(writes?.percentage || 0),
          deletes_percentage: Number(deletes?.percentage || 0),
          reads_usage: Number(reads?.usage || 0),
          writes_usage: Number(writes?.usage || 0),
          deletes_usage: Number(deletes?.usage || 0),
          updated_at: FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    console.log('free-tier-monitor', {
      dayKey,
      results,
    });
    return json(res, 200, {
      ok: true,
      day: dayKey,
      guardMode,
      maxPercentage,
      results,
    });
  } catch (error) {
    console.error('free-tier-monitor', error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
function saoPauloClock() {
  const now = DateTime.now().setZone('America/Sao_Paulo');
  return {
    date: now.toFormat('yyyy-LL-dd'),
    time: now.toFormat('HH:mm'),
    dayOfWeek: now.weekday % 7,
  };
}
function timestampLocalDate(value) {
  if (!value) return null;
  let date;
  if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return DateTime.fromJSDate(date).setZone('America/Sao_Paulo').toFormat('yyyy-LL-dd');
}
function scheduledTaskDocumentId(scheduleId, localDate) {
  const safeScheduleId = String(scheduleId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `scheduled_${safeScheduleId}_${localDate}`;
}
function isScheduleDueToday(schedule, clock) {
  if (schedule.active === false) {
    return false;
  }
  const recurrence = schedule.recurrence === 'specific_days' ? 'specific_days' : 'daily';
  const daysOfWeek = Array.isArray(schedule.days_of_week) ? schedule.days_of_week.map(Number) : [];
  if (recurrence === 'specific_days' && !daysOfWeek.includes(clock.dayOfWeek)) {
    return false;
  }
  const scheduleTime = String(schedule.schedule_time || '08:00');
  if (!/^\d{2}:\d{2}$/.test(scheduleTime)) {
    return false;
  }
  if (clock.time < scheduleTime) {
    return false;
  }
  if (schedule.last_occurrence_key === clock.date) {
    return false;
  }
  return timestampLocalDate(schedule.last_created_at) !== clock.date;
}
async function createScheduledTaskOccurrence(scheduleId, schedule, localDate) {
  const taskId = scheduledTaskDocumentId(scheduleId, localDate);
  const taskRef = db.collection('tasks').doc(taskId);
  const scheduleRef = db.collection('scheduled_tasks').doc(scheduleId);
  const notificationRef = db.collection('notifications').doc(taskId);
  const existingTask = await taskRef.get();
  let created = false;
  if (!existingTask.exists) {
    const now = new Date();
    await taskRef.create({
      title: String(schedule.title || ''),
      description: String(schedule.description || ''),
      status: 'todo',
      priority: ['high', 'medium', 'low'].includes(schedule.priority)
        ? schedule.priority
        : 'medium',
      assignee_id: schedule.assign_mode === 'employee' ? String(schedule.assignee_id || '') : '',
      created_by: String(schedule.created_by || ''),
      deadline: localDate,
      sector: schedule.assign_mode === 'sector' ? schedule.sector || null : null,
      status_history: [
        {
          status: 'todo',
          enteredAt: now.toISOString(),
        },
      ],
      image_url: null,
      image_urls: [],
      response: null,
      scheduled_task_id: scheduleId,
      scheduled_occurrence: localDate,
      created_at: now,
      updated_at: now,
    });
    created = true;
  }
  if (schedule.assign_mode === 'employee' && schedule.assignee_id) {
    await notificationRef.set(
      {
        user_id: String(schedule.assignee_id),
        message: `Nova tarefa atribuída: ${String(schedule.title || '')}`,
        type: 'task_created',
        read: false,
        task_id: taskId,
        scheduled_task_id: scheduleId,
        created_at: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }
  await scheduleRef.set(
    {
      last_created_at: FieldValue.serverTimestamp(),
      last_occurrence_key: localDate,
      next_run_at: calculateNextRunAt({ ...schedule, last_occurrence_key: localDate }),
      updated_at: FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );
  console.log('scheduled-task occurrence', {
    scheduleId,
    taskId,
    localDate,
    result: created ? 'created' : 'already-exists',
  });
  return created ? 'created' : 'already-exists';
}
async function processScheduledTasks() {
  // Ative SÓ depois de backfill da produção e deploy do frontend.
  const optimized = process.env.NEXT_RUN_QUERY_ENABLED === 'true';
  const now = new Date();
  const schedulesSnapshot = optimized
    ? await db.collection('scheduled_tasks').where('next_run_at', '<=', now).limit(200).get()
    : await db.collection('scheduled_tasks').get();
  const clock = saoPauloClock();
  const summary = {
    checked: schedulesSnapshot.size,
    due: 0,
    created: 0,
    alreadyCreated: 0,
    skipped: 0,
    failed: 0,
  };
  for (const scheduleDocument of schedulesSnapshot.docs) {
    const schedule = scheduleDocument.data();
    if (!isScheduleDueToday(schedule, clock)) {
      summary.skipped += 1;
      continue;
    }
    summary.due += 1;
    try {
      const result = await createScheduledTaskOccurrence(scheduleDocument.id, schedule, clock.date);
      if (result === 'created') {
        summary.created += 1;
      } else {
        summary.alreadyCreated += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`scheduled-task ${scheduleDocument.id}`, error);
    }
  }
  console.log('scheduled-tasks summary', {
    ...summary,
    localDate: clock.date,
    localTime: clock.time,
  });
  return {
    ...summary,
    localDate: clock.date,
    localTime: clock.time,
  };
}
async function currentCostGuardMode() {
  const snapshot = await db.collection('system_runtime').doc('firestore_guard').get();
  if (!snapshot.exists) {
    return 'normal';
  }
  return String(snapshot.data()?.mode || 'normal');
}
async function handleScheduledTasks(_req, res) {
  try {
    const guardMode = await currentCostGuardMode();
    // Tarefas essenciais continuam mesmo em protected; consulta otimizada reduz leituras.
    if (guardMode === 'protected')
      console.warn('Cost Guard protected: scheduler essencial mantido');
    const summary = await processScheduledTasks();
    return json(res, 200, { ok: true, guardMode, ...summary });
  } catch (error) {
    console.error('scheduled-tasks', error);
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'japanflow-api',
    });
  }
  if (req.method === 'POST' && req.url === '/billing/budget-alert') {
    return handleBudgetAlert(req, res);
  }
  if (req.method === 'POST' && req.url === '/monitor/free-tier') {
    return handleFreeTierMonitor(req, res);
  }
  if (req.method === 'POST' && req.url === '/jobs/scheduled-tasks') {
    return handleScheduledTasks(req, res);
  }
  return json(res, 404, {
    error: 'Not found',
  });
});
server.listen(port, '0.0.0.0', () => {
  console.log(`JapanFlow API running on port ${port}`);
});
