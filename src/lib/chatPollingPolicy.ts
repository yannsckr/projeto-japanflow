/** Política de polling: não gastar chamadas enquanto a aba está oculta/offline. */
export function shouldRefreshChatCounts(visible: boolean, online: boolean): boolean {
  return visible && online;
}

/** Evita repetir chamada em intervalos menores que o mínimo configurado. */
export function isChatCountsRefreshDue(
  now: number,
  lastStarted: number,
  minimumMs = 20_000
): boolean {
  return lastStarted === 0 || now - lastStarted >= minimumMs;
}
