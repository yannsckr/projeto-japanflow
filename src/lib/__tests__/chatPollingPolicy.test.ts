import { describe, expect, it } from 'vitest';
import { isChatCountsRefreshDue, shouldRefreshChatCounts } from '../chatPollingPolicy';

describe('Lote 7: política de atualização dos contadores do chat', () => {
  it('consulta quando a aba está visível e online', () => {
    expect(shouldRefreshChatCounts(true, true)).toBe(true);
  });
  it('não consulta em segundo plano nem offline', () => {
    expect(shouldRefreshChatCounts(false, true)).toBe(false);
    expect(shouldRefreshChatCounts(true, false)).toBe(false);
    expect(shouldRefreshChatCounts(false, false)).toBe(false);
  });
  it('respeita intervalo mínimo entre chamadas', () => {
    expect(isChatCountsRefreshDue(100_000, 0)).toBe(true);
    expect(isChatCountsRefreshDue(110_000, 100_000)).toBe(false);
    expect(isChatCountsRefreshDue(120_000, 100_000)).toBe(true);
  });
});
