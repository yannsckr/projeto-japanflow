/** Funções puras para telemetria GPS. Não substituem a coleta, persistência ou resumo agendado. */
export type GpsSample = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

const EARTH_RADIUS_M = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMeters(a: GpsSample, b: GpsSample): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export type SegmentResult =
  | { accepted: true; meters: number }
  | { accepted: false; reason: 'invalid' | 'inaccurate' | 'time' | 'jump' | 'stationary' };

/** Evita contabilizar ruído estacionário e saltos de GPS como deslocamento. */
export function measureGpsSegment(previous: GpsSample, current: GpsSample): SegmentResult {
  if (
    ![
      previous.lat,
      previous.lng,
      previous.accuracy,
      previous.timestamp,
      current.lat,
      current.lng,
      current.accuracy,
      current.timestamp,
    ].every(Number.isFinite) ||
    Math.abs(previous.lat) > 90 ||
    Math.abs(current.lat) > 90 ||
    Math.abs(previous.lng) > 180 ||
    Math.abs(current.lng) > 180
  )
    return { accepted: false, reason: 'invalid' };
  if (previous.accuracy > 50 || current.accuracy > 50) {
    return { accepted: false, reason: 'inaccurate' };
  }
  const seconds = (current.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0 || seconds > 300) return { accepted: false, reason: 'time' };
  const meters = distanceMeters(previous, current);
  if (meters < Math.max(15, previous.accuracy + current.accuracy)) {
    return { accepted: false, reason: 'stationary' };
  }
  if (meters / seconds > 40) return { accepted: false, reason: 'jump' };
  return { accepted: true, meters };
}

export const kilometers = (meters: number) => Math.round((meters / 1000) * 100) / 100;
