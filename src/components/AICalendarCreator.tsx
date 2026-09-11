import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Check, CalendarDays, Bell, ListTodo, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { SECTOR_LABELS } from '@/types';
import type { Sector } from '@/types';
import { cn } from '@/lib/utils';
import { parseCalendarEventsApi } from '@/lib/api';
import type { ParsedAiItem, ParsedCalendarItem, ParsedTaskItem } from '@/lib/api';

type ReviewItem = ParsedAiItem & { selected: boolean };

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const AICalendarCreator = () => {
  const { currentUser, users, addCalendarEvent, addTask } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parsedItems, setParsedItems] = useState<ReviewItem[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');

  const activeUsers = users.filter((user) => user.active !== false);

  const resolveTaskAssignee = (task: ParsedTaskItem) => {
    if (task.assigneeId) {
      const byId = activeUsers.find((user) => user.id === task.assigneeId);
      if (byId) return byId;
    }

    if (!task.assigneeName) return null;

    const target = normalize(task.assigneeName);
    return (
      activeUsers.find((user) => normalize(user.name) === target) ||
      activeUsers.find(
        (user) => normalize(user.name).includes(target) || target.includes(normalize(user.name))
      ) ||
      null
    );
  };

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error('Descreva o que deseja criar');
      return;
    }

    setLoading(true);
    try {
      const sectors = Object.entries(SECTOR_LABELS).map(([id, label]) => ({ id, label }));
      const usersList = activeUsers.map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        sectors: user.sectors,
        function: user.function || '',
      }));

      const data = await parseCalendarEventsApi({
        text: text.trim(),
        users: usersList,
        sectors,
      });

      const sourceItems: ParsedAiItem[] =
        data.items?.length > 0
          ? data.items
          : (data.events || []).map((event) => ({ ...event, kind: 'calendar' as const }));

      const items = sourceItems.map((item) => ({ ...item, selected: true }));

      if (items.length === 0) {
        toast.error('Nenhuma ação identificada no texto');
        return;
      }

      setParsedItems(items);
      setStep('review');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao interpretar o comando');
    } finally {
      setLoading(false);
    }
  };

  const resolveTargetUsers = (event: ParsedCalendarItem): string[] => {
    if (event.targetMode === 'all') return activeUsers.map((user) => user.id);

    if (event.targetMode === 'sector') {
      const sectorKey = Object.entries(SECTOR_LABELS).find(
        ([id, label]) =>
          normalize(label) === normalize(event.targetInfo) ||
          normalize(id) === normalize(event.targetInfo)
      )?.[0] as Sector | undefined;

      if (sectorKey) {
        return activeUsers
          .filter((user) => user.sectors?.includes(sectorKey) || user.role === 'admin')
          .map((user) => user.id);
      }

      return [];
    }

    const names = event.targetInfo
      .split(',')
      .map((name) => normalize(name))
      .filter(Boolean);

    return activeUsers
      .filter((user) =>
        names.some(
          (name) => normalize(user.name).includes(name) || name.includes(normalize(user.name))
        )
      )
      .map((user) => user.id);
  };

  const taskDescription = (task: ParsedTaskItem) => {
    const description = task.description.trim();
    if (!task.time) return description;

    const normalizedDescription = normalize(description);
    const normalizedTime = task.time.replace(':', 'h');
    if (
      normalizedDescription.includes(task.time.toLowerCase()) ||
      normalizedDescription.includes(normalizedTime.toLowerCase())
    ) {
      return description;
    }

    return [description, `Horário: ${task.time}`].filter(Boolean).join('\n');
  };

  const handleCreate = async () => {
    if (!currentUser) return;

    const selected = parsedItems.filter((item) => item.selected);
    if (selected.length === 0) {
      toast.error('Selecione ao menos um item');
      return;
    }

    const invalidTasks = selected.filter(
      (item): item is ParsedTaskItem & { selected: boolean } =>
        item.kind === 'task' && !resolveTaskAssignee(item)
    );

    if (invalidTasks.length > 0) {
      const names = invalidTasks.map((task) => task.assigneeName || task.title).join(', ');
      toast.error(`Não encontrei o funcionário para: ${names}. Revise o comando.`);
      return;
    }

    setCreating(true);
    try {
      let tasksCreated = 0;
      let calendarCreated = 0;

      for (const item of selected) {
        if (item.kind === 'task') {
          const assignee = resolveTaskAssignee(item);
          if (!assignee) continue;

          addTask({
            title: item.title,
            description: taskDescription(item),
            status: 'todo',
            priority: item.priority || 'medium',
            assigneeId: assignee.id,
            createdBy: currentUser.id,
            deadline: item.deadline || '',
          });
          tasksCreated += 1;
          continue;
        }

        const targetUsers = resolveTargetUsers(item);
        if (item.targetMode !== 'all' && targetUsers.length === 0) {
          throw new Error(`Não encontrei o destino do calendário: ${item.targetInfo}`);
        }

        addCalendarEvent({
          title: item.title,
          description: item.description || '',
          date: item.date,
          time: item.time || undefined,
          userId: currentUser.id,
          createdBy: currentUser.id,
          type: item.type,
          targetMode: item.targetMode,
          targetUsers,
        });
        calendarCreated += 1;
      }

      const parts = [
        tasksCreated ? `${tasksCreated} tarefa(s)` : '',
        calendarCreated ? `${calendarCreated} item(ns) de calendário` : '',
      ].filter(Boolean);

      toast.success(`${parts.join(' e ')} criado(s) com sucesso!`);
      handleClose();
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível criar os itens');
    } finally {
      setCreating(false);
    }
  };

  const toggleItem = (index: number) => {
    setParsedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleClose = () => {
    setOpen(false);
    setText('');
    setParsedItems([]);
    setStep('input');
    setLoading(false);
    setCreating(false);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return dateStr;
    return `${match[3]}/${match[2]}/${match[1]}`;
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        Criar com IA
      </Button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) handleClose();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Criar com IA
            </DialogTitle>
          </DialogHeader>

          {step === 'input' && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Descreva tarefas, eventos ou lembretes em linguagem natural. A IA interpreta e você
                revisa tudo antes de criar.
              </p>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={`Exemplos:\n- Separar produto do pedido 12345 para Ryan\n- Criar entrega para Rafael na MHS às 15h\n- Reunião geral amanhã às 14h\n- Lembrar vendas de enviar o relatório sexta às 9h`}
                rows={7}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleParse} disabled={loading} className="gap-1.5">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {loading ? 'Processando...' : 'Interpretar'}
                </Button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                {parsedItems.length} item(ns) identificado(s). Revise e confirme:
              </p>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {parsedItems.map((item, index) => {
                  const assignee = item.kind === 'task' ? resolveTaskAssignee(item) : null;

                  return (
                    <div
                      key={`${item.kind}-${index}`}
                      onClick={() => toggleItem(index)}
                      className={cn(
                        'border rounded-lg p-3 cursor-pointer transition-all',
                        item.selected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border bg-muted/30 opacity-60'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                            item.selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}
                        >
                          {item.selected && <Check className="w-3 h-3" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {item.kind === 'task' ? (
                              <ListTodo className="w-3.5 h-3.5 text-primary" />
                            ) : item.type === 'reminder' ? (
                              <Bell className="w-3.5 h-3.5 text-yellow-500" />
                            ) : (
                              <CalendarDays className="w-3.5 h-3.5 text-primary" />
                            )}
                            <span className="font-medium text-sm">{item.title}</span>
                          </div>

                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                              {item.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {item.kind === 'task' ? (
                              <>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                  ✅ Tarefa
                                </span>
                                <span
                                  className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded bg-secondary flex items-center gap-1',
                                    !assignee && 'text-destructive'
                                  )}
                                >
                                  <UserRound className="w-3 h-3" />
                                  {assignee?.name ||
                                    item.assigneeName ||
                                    'Funcionário não identificado'}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                  Prioridade:{' '}
                                  {item.priority === 'high'
                                    ? 'Alta'
                                    : item.priority === 'low'
                                      ? 'Baixa'
                                      : 'Média'}
                                </span>
                                {item.deadline && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                    📅 {formatDate(item.deadline)}
                                  </span>
                                )}
                                {item.time && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                    🕐 {item.time}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                  📅 {formatDate(item.date)}
                                </span>
                                {item.time && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                    🕐 {item.time}
                                  </span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                  👥 {item.targetMode === 'all' ? 'Todos' : item.targetInfo}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                                  {item.type === 'reminder' ? '🔔 Lembrete' : '📌 Evento'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep('input')} disabled={creating}>
                  Voltar
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleClose} disabled={creating}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {creating
                      ? 'Criando...'
                      : `Criar ${parsedItems.filter((item) => item.selected).length} item(ns)`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AICalendarCreator;
