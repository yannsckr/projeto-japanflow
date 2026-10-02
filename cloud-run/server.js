import http from 'node:http';
import { Firestore, FieldValue } from '@google-cloud/firestore';

const port = Number(process.env.PORT || 8080);
const db = new Firestore();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
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
  if (percentage >= 1) return 'critical';
  if (percentage >= 0.9) return 'critical';
  if (percentage >= 0.75) return 'warning';
  if (percentage >= 0.5) return 'attention';
  return 'info';
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
      return json(res, 200, { ok: true, recipients: 0 });
    }

    const batch = db.batch();

    for (const [userId] of recipients) {
      const ref = db.collection('system_notifications').doc();

      batch.set(ref, {
        recipient_user_id: userId,
        type: 'billing_budget',
        source: 'google-cloud',
        title:
          percentage >= 100 ? 'Limite de orçamento atingido' : `Orçamento Google em ${percentage}%`,
        message: `Uso aproximado: R$ ${cost.toFixed(2)} de R$ ${budgetAmount.toFixed(2)}.`,
        severity: severityFromPercentage(threshold),
        budget_percentage: percentage,
        cost_amount: cost,
        budget_amount: budgetAmount,
        currency: budget.currencyCode || 'BRL',
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    console.log('budget-alert', {
      percentage,
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

  return json(res, 404, {
    error: 'Not found',
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`JapanFlow API running on port ${port}`);
});
