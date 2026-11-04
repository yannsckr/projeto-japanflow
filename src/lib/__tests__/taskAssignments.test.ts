import { describe, expect, it } from 'vitest';
import {
  normalizeAssigneeIds,
  singleAssigneeUpdate,
  taskAssigneeCreateFields,
} from '../taskAssignments';

describe('atribuições de tarefas', () => {
  it('preserva múltiplos destinatários na criação', () => {
    expect(taskAssigneeCreateFields('emp-paloma', ['emp-joe', 'emp-ana'])).toEqual({
      assignee_id: 'emp-paloma',
      assignee_ids: ['emp-joe', 'emp-ana'],
    });
  });
  it('remove duplicatas e valores inválidos sem converter objetos em IDs', () => {
    expect(normalizeAssigneeIds([' emp-joe ', 'emp-joe', '', null, 5])).toEqual(['emp-joe']);
  });
  it('não inventa uma lista coletiva para tarefas individuais antigas', () => {
    expect(taskAssigneeCreateFields('emp-joe')).toEqual({ assignee_id: 'emp-joe' });
  });
  it('remove a atribuição compartilhada anterior numa transferência individual', () => {
    expect(singleAssigneeUpdate(' emp-joe ')).toEqual({
      assignee_id: 'emp-joe',
      assignee_ids: [],
    });
  });
});
