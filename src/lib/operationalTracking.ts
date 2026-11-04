/** Compatibilidade de registros operacionais legados. Não altera documentos. */
export function normalizePickupStatus(status: unknown): 'pending' | 'done' {
  const normalized = String(status ?? 'pending')
    .trim()
    .toLowerCase();
  return ['done', 'completed', 'concluido', 'concluído', 'finalizado'].includes(normalized)
    ? 'done'
    : 'pending';
}

export function toOperationalIso(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') {
      const date = toDate.call(value) as Date;
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
    }
  }
  return '';
}

export function canAccessPickups(
  user: { id: string; role: string; sectors?: string[]; username?: string } | null
): boolean {
  if (!user) return false;
  const clean = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  if (clean(user.role) === 'admin') return true;
  if (['jean_', 'joe_'].includes(clean(user.username || ''))) return true;
  const sectors = (user.sectors || []).map(clean);
  if (sectors.some((sector) => ['vendas', 'expedicao', 'administracao'].includes(sector)))
    return true;
  return ['emp-1', 'emp-2', 'emp-9', 'emp-1781181301491'].includes(user.id);
}

export function relatedRideToTask(rideDescription: string, taskTitle: string): boolean {
  const needle = taskTitle.trim().toLocaleLowerCase('pt-BR');
  return needle.length >= 4 && rideDescription.toLocaleLowerCase('pt-BR').includes(needle);
}
