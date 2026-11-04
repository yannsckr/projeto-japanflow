'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDailySummary, daySaoPaulo, validSegment } = require('../motoboyDailySummaryCore.cjs');
const date = (iso) => new Date(iso);
const completedRide = (id, assigned_to, status = 'completed') => ({
  id, assigned_to, status,
  accepted_at: date('2026-11-04T14:00:00Z'),
  completed_at: date('2026-11-04T14:20:00Z'),
});
const point = (ride_id, user_id, lat, t, day = '2026-11-04') => ({
  ride_id, user_id, lat, lng: -45.9, accuracy: 5, client_at: Date.parse(t), day,
  meters: 999999,
});

test('uses Sao Paulo calendar date rather than runtime locale', () => {
  assert.equal(daySaoPaulo(new Date('2026-11-05T01:00:00Z')), '2026-11-04');
});

test('never includes samples for unfinished rides or unknown rides', () => {
  const rides = [completedRide('a', 'u1'), completedRide('b', 'u1', 'accepted')];
  const gps = [
    point('a', 'u1', -23.10, '2026-11-04T14:00:00Z'),
    point('a', 'u1', -23.101, '2026-11-04T14:01:00Z'),
    point('b', 'u1', -23.10, '2026-11-04T14:00:00Z'),
    point('b', 'u1', -23.109, '2026-11-04T14:02:00Z'),
    point('missing', 'u1', -23.1, '2026-11-04T14:00:00Z'),
  ];
  const [result] = buildDailySummary('2026-11-04', rides, gps);
  assert.equal(result.rides, 1);
  assert.deepEqual(result.ride_ids, ['a']);
  assert.ok(result.km > 0 && result.km < 0.5);
});

test('ignores cross-user, out-of-window, and wrong-day samples', () => {
  const ride = completedRide('a', 'u1');
  const gps = [
    point('a', 'u2', -23.1, '2026-11-04T14:00:00Z'),
    point('a', 'u2', -23.15, '2026-11-04T14:02:00Z'),
    point('a', 'u1', -23.1, '2026-11-04T13:00:00Z'),
    point('a', 'u1', -23.12, '2026-11-04T14:30:00Z'),
    point('a', 'u1', -23.1, '2026-11-04T14:00:00Z', '2026-11-03'),
  ];
  assert.equal(buildDailySummary('2026-11-04', [ride], gps)[0].km, 0);
});

test('never connects two different ride IDs into one GPS segment', () => {
  const rides = [completedRide('a', 'u1'), completedRide('b', 'u1')];
  const gps = [
    point('a', 'u1', -23.1, '2026-11-04T14:00:00Z'),
    point('b', 'u1', -23.101, '2026-11-04T14:01:00Z'),
  ];
  const [result] = buildDailySummary('2026-11-04', rides, gps);
  assert.equal(result.rides, 2);
  assert.equal(result.km, 0);
  assert.equal(result.recorded_segments, 0);
});

test('ignores impossible jumps and negative GPS accuracy', () => {
  const a = { lat: -23.1, lng: -45.9, accuracy: 5, client_at: 1000 };
  const b = { lat: -23.5, lng: -45.9, accuracy: 5, client_at: 2000 };
  assert.equal(validSegment(a, b), 0);
  assert.equal(validSegment(a, { ...b, accuracy: -1 }), 0);
});
