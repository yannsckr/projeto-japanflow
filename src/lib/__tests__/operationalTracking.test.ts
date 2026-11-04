import { describe, expect, it } from 'vitest';
import {
  canAccessPickups,
  normalizePickupStatus,
  relatedRideToTask,
  toOperationalIso,
} from '../operationalTracking';

describe('Lote 4 — operações', () => {
  it('reconhece estados históricos de retirada', () => {
    expect(normalizePickupStatus('completed')).toBe('done');
    expect(normalizePickupStatus('concluído')).toBe('done');
    expect(normalizePickupStatus('done')).toBe('done');
    expect(normalizePickupStatus('pending')).toBe('pending');
  });
  it('lê datas em texto e timestamp Firestore', () => {
    expect(toOperationalIso('2026-11-04T12:00:00.000Z')).toBe('2026-11-04T12:00:00.000Z');
    expect(toOperationalIso({ toDate: () => new Date('2026-11-04T12:00:00.000Z') })).toBe(
      '2026-11-04T12:00:00.000Z'
    );
  });
  it('aceita Vendas e Expedição mesmo com acentos ou diferenças de caixa', () => {
    expect(canAccessPickups({ id: 'u1', role: 'employee', sectors: ['Expedição'] })).toBe(true);
    expect(canAccessPickups({ id: 'u2', role: 'employee', sectors: ['Vendas'] })).toBe(true);
    expect(canAccessPickups({ id: 'u3', role: 'employee', sectors: ['outros'] })).toBe(false);
  });
  it('não associa corridas a tarefas genéricas de título curto', () => {
    expect(relatedRideToTask('Entrega do pedido Alfa', 'Entrega')).toBe(true);
    expect(relatedRideToTask('Entrega do pedido Alfa', 'A')).toBe(false);
    expect(relatedRideToTask('Entrega do pedido Alfa', 'Pedido Beta')).toBe(false);
  });
});
