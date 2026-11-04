import { describe, expect, it } from 'vitest';
import { dayInSaoPaulo, measureGpsSegment } from '../motoboyTelemetry';

describe('Telemetria dos motoboys', () => {
  it('usa a data local de Sao Paulo para particionar amostras', () => {
    expect(dayInSaoPaulo(new Date('2026-11-05T01:00:00Z'))).toBe('2026-11-04');
  });

  it('nao contabiliza saltos impossiveis ou intervalos longos', () => {
    const a = { lat: -23.1, lng: -45.9, accuracy: 5, timestamp: 1000 };
    expect(measureGpsSegment(a, { ...a, lat: -23.5, timestamp: 2000 })).toEqual({
      accepted: false,
      reason: 'jump',
    });
    expect(measureGpsSegment(a, { ...a, lat: -23.101, timestamp: 600_000 })).toEqual({
      accepted: false,
      reason: 'time',
    });
  });
});
