'use strict';

const EARTH_RADIUS_M = 6371000;
const radians = (degrees) => (degrees * Math.PI) / 180;

function daySaoPaulo(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function timestampMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return NaN;
}

function distanceMeters(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function validPoint(point) {
  return point &&
    [point.lat, point.lng, point.accuracy, point.client_at].every(Number.isFinite) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 &&
    point.accuracy >= 0 && point.accuracy <= 50;
}

function validSegment(a, b) {
  if (!validPoint(a) || !validPoint(b)) return 0;
  const seconds = (b.client_at - a.client_at) / 1000;
  if (seconds <= 0 || seconds > 300) return 0;
  const meters = distanceMeters(a, b);
  return meters >= Math.max(15, a.accuracy + b.accuracy) && meters / seconds <= 40
    ? meters : 0;
}

/**
 * Computes a snapshot of rides completed on the chosen São Paulo calendar day.
 * A sample is counted only for its own completed ride and assigned rider.
 * Client-provided distance is deliberately ignored.
 */
function buildDailySummary(day, assignments, telemetry) {
  const byUser = new Map();
  const completedRides = new Map();
  for (const ride of assignments) {
    if (!ride || ride.status !== 'completed' || !ride.assigned_to || !ride.id) continue;
    const completedAt = timestampMillis(ride.completed_at);
    if (!Number.isFinite(completedAt) || daySaoPaulo(new Date(completedAt)) !== day) continue;
    const acceptedAt = timestampMillis(ride.accepted_at);
    const item = byUser.get(ride.assigned_to) || {
      user_id: ride.assigned_to, rides: 0, km: 0, recorded_segments: 0,
      ride_ids: [], duration_minutes: 0,
    };
    item.rides += 1;
    item.ride_ids.push(ride.id);
    if (Number.isFinite(acceptedAt) && acceptedAt < completedAt) {
      item.duration_minutes += Math.round((completedAt - acceptedAt) / 60000);
    }
    byUser.set(ride.assigned_to, item);
    completedRides.set(ride.id, { userId: ride.assigned_to, acceptedAt, completedAt });
  }

  const byRide = new Map();
  for (const sample of telemetry) {
    if (!sample || !sample.ride_id || !sample.user_id || !validPoint(sample)) continue;
    const ride = completedRides.get(sample.ride_id);
    if (!ride || ride.userId !== sample.user_id) continue;
    if (sample.day !== day) continue;
    // Exclude points recorded outside this ride's operational lifecycle.
    if ((Number.isFinite(ride.acceptedAt) && sample.client_at < ride.acceptedAt) ||
      sample.client_at > ride.completedAt) continue;
    const existing = byRide.get(sample.ride_id) || [];
    existing.push(sample);
    byRide.set(sample.ride_id, existing);
  }

  for (const [rideId, samples] of byRide) {
    const ride = completedRides.get(rideId);
    const item = byUser.get(ride.userId);
    samples.sort((a, b) => a.client_at - b.client_at);
    for (let i = 1; i < samples.length; i++) {
      const meters = validSegment(samples[i - 1], samples[i]);
      if (meters > 0) {
        item.km += meters / 1000;
        item.recorded_segments += 1;
      }
    }
  }

  return [...byUser.values()]
    .map((item) => ({
      ...item,
      ride_ids: item.ride_ids.sort(),
      km: Math.round(item.km * 100) / 100,
      limited_gps_coverage: item.recorded_segments === 0,
    }))
    .sort((a, b) => a.user_id.localeCompare(b.user_id));
}

module.exports = { buildDailySummary, daySaoPaulo, validSegment, timestampMillis };
