/** Normaliza destinatários sem misturar atribuição individual e coletiva. */
export function normalizeAssigneeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];
}

/** Um destinatário explícito substitui uma atribuição compartilhada anterior. */
export function singleAssigneeUpdate(assigneeId: string) {
  return { assignee_id: assigneeId.trim(), assignee_ids: [] as string[] };
}

/** Mantém a lista coletiva quando fornecida, sem inventar destinatários. */
export function taskAssigneeCreateFields(assigneeId: string, assigneeIds?: string[]) {
  const primary = assigneeId.trim();
  const shared = normalizeAssigneeIds(assigneeIds);
  return {
    assignee_id: primary,
    ...(assigneeIds !== undefined ? { assignee_ids: shared } : {}),
  };
}
