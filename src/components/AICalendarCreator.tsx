import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Check, X, CalendarDays, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Sector, SECTOR_LABELS } from '@/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { cn } from '@/lib/utils';

interface ParsedEvent {
  title: string;
  description?: string;
  date: string;
  time: string | null;
  type: 'event' | 'reminder';
  targetMode: 'all' | 'sector' | 'specific';
  targetInfo: string;
  selected: boolean;
}

const AICalendarCreator = () => {
  const { currentUser, users, addCalendarEvent } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error('Digite os eventos que deseja criar');
      return;
    }
    setLoading(true);
    try {
      const sectors = Object.entries(SECTOR_LABELS).map(([k, v]) => ({ id: k, label: v }));
      const usersList = users.map((u) => ({ id: u.id, name: u.name, sectors: u.sectors }));

      const functions = getFunctions();
      const parseCalendarEvents = httpsCallable<
        {
          text: string;
          users: Array<{ id: string; name: string; sectors?: Sector[] }>;
          sectors: Array<{ id: string; label: string }>;
        },
        { events?: any[]; error?: string }
      >(functions, 'parseCalendarEvents');

      const result = await parseCalendarEvents({
        text: text.trim(),
        users: usersList,
        sectors,
      });

      const data = result.data;

      if (data?.error) throw new Error(data.error);

      const events = (data.events || []).map((e: any) => ({ ...e, selected: true }));
      if (events.length === 0) {
        toast.error('Nenhum evento identificado no texto');
        return;
      }

      setParsedEvents(events);
      setStep('review');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar eventos');
    } finally {
      setLoading(false);
    }
  };

  const resolveTargetUsers = (event: ParsedEvent): string[] => {
    if (event.targetMode === 'all') return users.map((u) => u.id);

    if (event.targetMode === 'sector') {
      const sectorKey = Object.entries(SECTOR_LABELS).find(
        ([, label]) => label.toLowerCase() === event.targetInfo.toLowerCase()
      )?.[0] as Sector | undefined;
      if (sectorKey) {
        return users
          .filter((u) => u.sectors?.includes(sectorKey) || u.role === 'admin')
          .map((u) => u.id);
      }
      return users.map((u) => u.id);
    }

    const names = event.targetInfo.split(',').map((n) => n.trim().toLowerCase());
    const matched = users.filter((u) => names.some((n) => u.name.toLowerCase().includes(n)));
    return matched.length > 0 ? matched.map((u) => u.id) : users.map((u) => u.id);
  };

  const handleCreate = async () => {
    if (!currentUser) return;
    const selected = parsedEvents.filter((e) => e.selected);
    if (selected.length === 0) {
      toast.error('Selecione ao menos um evento');
      return;
    }

    for (const event of selected) {
      const targetUsers = resolveTargetUsers(event);
      await addCalendarEvent({
        title: event.title,
        description: event.description || '',
        date: event.date,
        time: event.time || undefined,
        userId: currentUser.id,
        createdBy: currentUser.id,
        type: event.type,
        targetMode: event.targetMode,
        targetUsers,
      });
    }

    toast.success(`${selected.length} evento(s) criado(s) com sucesso!`);
    handleClose();
  };

  const toggleEvent = (index: number) => {
    setParsedEvents((prev) =>
      prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e))
    );
  };

  const handleClose = () => {
    setOpen(false);
    setText('');
    setParsedEvents([]);
    setStep('input');
  };

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        Criar com IA
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Criar Eventos com IA
            </DialogTitle>
          </DialogHeader>

          {step === 'input' && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Descreva os eventos que deseja criar em linguagem natural. A IA vai interpretar e
                criar todos de uma vez.
              </p>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Exemplo:\n- Reunião geral dia 15 às 14h\n- Lembrete para o setor de vendas dia 20 às 9h: Enviar relatório\n- Inventário no estoque amanhã às 8h`}
                rows={6}
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
                {parsedEvents.length} evento(s) identificado(s). Revise e confirme:
              </p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {parsedEvents.map((event, i) => (
                  <div
                    key={i}
                    onClick={() => toggleEvent(i)}
                    className={cn(
                      'border rounded-lg p-3 cursor-pointer transition-all',
                      event.selected
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-muted/30 opacity-60'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                          event.selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}
                      >
                        {event.selected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {event.type === 'reminder' ? (
                            <Bell className="w-3.5 h-3.5 text-yellow-500" />
                          ) : (
                            <CalendarDays className="w-3.5 h-3.5 text-primary" />
                          )}
                          <span className="font-medium text-sm">{event.title}</span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                            📅 {formatDate(event.date)}
                          </span>
                          {event.time && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                              🕐 {event.time}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                            👥 {event.targetMode === 'all' ? 'Todos' : event.targetInfo}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                            {event.type === 'reminder' ? '🔔 Lembrete' : '📌 Evento'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep('input')}>
                  Voltar
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} className="gap-1.5">
                    <Check className="w-4 h-4" />
                    Criar {parsedEvents.filter((e) => e.selected).length} evento(s)
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
