import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { calculateNextRunAt } from './cloud-run/schedule-utils.js';
const zone = 'America/Sao_Paulo';
const now = DateTime.fromISO('2026-10-08T09:30:00', { zone }); // Quinta-feira
const at = (s) => calculateNextRunAt(s, now)?.toISOString();
assert.equal(
  at({ active: true, recurrence: 'daily', schedule_time: '08:00' }),
  '2026-10-08T11:00:00.000Z'
);
assert.equal(
  at({
    active: true,
    recurrence: 'daily',
    schedule_time: '08:00',
    last_occurrence_key: '2026-10-08',
  }),
  '2026-10-09T11:00:00.000Z'
);
assert.equal(
  at({ active: true, recurrence: 'specific_days', days_of_week: [1], schedule_time: '08:00' }),
  '2026-10-12T11:00:00.000Z'
);
assert.equal(calculateNextRunAt({ active: false, schedule_time: '08:00' }, now), null);
assert.equal(
  calculateNextRunAt(
    { active: true, recurrence: 'specific_days', days_of_week: [], schedule_time: '08:00' },
    now
  ),
  null
);
console.log('5/5 testes de recorrência passaram.');
