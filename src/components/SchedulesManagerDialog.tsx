import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { useApp } from '@/contexts/AppContext';
import { useWorkSchedules, upsertSchedule, deleteSchedule } from '@/hooks/useWorkSchedules';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  TIME_OPTIONS,
  WeekDays,
  addWeeks,
  emptyWeek,
  formatWeekRange,
  mondayOf,
  normalizeTimeInput,
} from '@/lib/workSchedule';
import { Calendar, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { parseScheduleApi } from '@/lib/api';

const SchedulesManagerDialog = () => {
  const { users, currentUser } = useApp();
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [weekStart, setWeekStart] = useState<string>(mondayOf(new Date()));
  const [days, setDays] = useState<WeekDays>(emptyWeek());
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    action: () => void | Promise<void>;
  } | null>(null);

  const { schedules, refetch } = useWorkSchedules(selectedUserId || undefined);

  useEffect(() => {
    if (!selectedUserId) {
      setDays(emptyWeek());
      return;
    }
    const existing = schedules.find((s) => s.week_start === weekStart);
    setDays(existing ? existing.days : emptyWeek());
  }, [selectedUserId, weekStart, schedules]);

  const existingSchedule = schedules.find((s) => s.week_start === weekStart);

  const handleDayChange = (day: DayKey, field: 'entry' | 'exit', value: string) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value === '__off' ? '' : value },
    }));
  };

  const handleSave = async () => {
    if (!selectedUserId) {
      toast({ title: 'Selecione um usuário', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await upsertSchedule({
        userId: selectedUserId,
        weekStart,
        days,
        createdBy: currentUser?.id,
      });
      toast({ title: 'Escala salva' });
      await refetch();
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: String(e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!existingSchedule) return;
    try {
      await deleteSchedule(existingSchedule.id);
      toast({ title: 'Escala excluída' });
      setDays(emptyWeek());
      await refetch();
    } catch (e) {
      toast({ title: 'Erro', description: String(e), variant: 'destructive' });
    }
  };

  const runAI = async (payload: { imageBase64?: string; mimeType?: string; text?: string }) => {
    if (!selectedUserId) {
      toast({ title: 'Selecione um usuário primeiro', variant: 'destructive' });
      return;
    }
    setAiBusy(true);
    try {
      const userName = users.find((u) => u.id === selectedUserId)?.name;

      const result = await parseScheduleApi({
        ...payload,
        userName,
        referenceWeekStart: weekStart,
      });

      const weeks = (result.weeks || []) as Array<{
        weekStart?: string;
        days: Partial<WeekDays>;
      }>;

      if (!weeks.length) {
        toast({ title: 'IA não retornou dados', variant: 'destructive' });
        setAiBusy(false);
        return;
      }

      let savedCount = 0;
      let firstWeekStart: string | null = null;
      let firstWeekDays: WeekDays | null = null;

      for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        const targetWeek =
          w.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(w.weekStart)
            ? mondayOf(new Date(w.weekStart + 'T00:00:00'))
            : addWeeks(weekStart, i);

        const merged: WeekDays = emptyWeek();
        for (const k of DAY_KEYS) {
          const d = w.days?.[k];
          if (d) merged[k] = { entry: d.entry || '', exit: d.exit || '' };
        }

        if (i === 0) {
          firstWeekStart = targetWeek;
          firstWeekDays = merged;
        }

        await upsertSchedule({
          userId: selectedUserId,
          weekStart: targetWeek,
          days: merged,
          createdBy: currentUser?.id,
        });
        savedCount++;
      }

      if (firstWeekStart && firstWeekDays) {
        setWeekStart(firstWeekStart);
        setDays(firstWeekDays);
      }

      await refetch();
      toast({
        title: 'Escala transcrita pela IA',
        description:
          weeks.length > 1
            ? `${weeks.length} semanas detectadas e salvas automaticamente. A semana exibida ficou aberta para conferência.`
            : `${savedCount} semana salva automaticamente. Revise se necessário.`,
      });
      setAiText('');
    } catch (e) {
      toast({ title: 'Erro da IA', description: String(e), variant: 'destructive' });
    }
    setAiBusy(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!selectedUserId) return;
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((it) => it.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        runAI({ imageBase64: base64, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTranscribeText = () => {
    if (!aiText.trim()) return;
    runAI({ text: aiText });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-1" /> Escalas
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escalas de Trabalho</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Usuário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sortedUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Semana</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart((w) => addWeeks(w, -1))}
                >
                  ‹
                </Button>
                <div className="flex-1 text-center text-sm font-medium border rounded h-10 flex items-center justify-center">
                  {formatWeekRange(weekStart)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart((w) => addWeeks(w, 1))}
                >
                  ›
                </Button>
              </div>
            </div>
          </div>

          {selectedUserId && (
            <>
              <div className="border rounded-lg p-3 bg-muted/30" onPaste={handlePaste}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Preencher com IA</span>
                  {aiBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <Textarea
                  placeholder="Cole o texto da escala (ou cole uma imagem com Ctrl+V dentro deste cartão). Pode conter várias semanas."
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={3}
                  disabled={aiBusy}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-muted-foreground">
                    Dica: imagens podem conter várias semanas — todas serão importadas.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleTranscribeText}
                    disabled={aiBusy || !aiText.trim()}
                  >
                    Transcrever texto
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground -mb-1">
                Preencha apenas <b>entrada</b> e <b>saída</b>. O intervalo de almoço é fixo de 1
                hora.
              </div>

              <div className="space-y-2">
                {DAY_KEYS.map((day) => (
                  <div key={day} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3 text-sm font-medium">{DAY_LABELS[day]}</div>
                    <div className="col-span-9">
                      <div className="flex gap-2 items-center">
                        <TimeInput
                          value={days[day]?.entry || ''}
                          onChange={(v) => handleDayChange(day, 'entry', v)}
                          placeholder="Entrada"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <TimeInput
                          value={days[day]?.exit || ''}
                          onChange={(v) => handleDayChange(day, 'exit', v)}
                          placeholder="Saída"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    setConfirmAction({
                      title: 'Excluir escala',
                      description:
                        'A escala desta semana será removida para o usuário selecionado.',
                      confirmLabel: 'Excluir',
                      destructive: true,
                      action: handleDelete,
                    })
                  }
                  disabled={!existingSchedule}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDays(emptyWeek())}>
                    Limpar
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Salvar escala
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.title || 'Confirmar ação'}
        description={confirmAction?.description || ''}
        confirmLabel={confirmAction?.confirmLabel}
        destructive={confirmAction?.destructive}
        onConfirm={async () => {
          if (!confirmAction) return;
          await confirmAction.action();
          setConfirmAction(null);
        }}
      />
    </>
  );
};

const TIME_LIST_ID = 'schedule-time-options';

const TimeInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (raw: string) => {
    if (!raw.trim()) {
      onChange('');
      setDraft('');
      return;
    }
    const norm = normalizeTimeInput(raw);
    if (norm) {
      onChange(norm);
      setDraft(norm);
    } else {
      // revert to last valid value
      setDraft(value);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-1">
      <Input
        type="text"
        inputMode="numeric"
        list={TIME_LIST_ID}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
        className="h-9 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            setDraft('');
          }}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1"
          title="Marcar como folga"
        >
          Folga
        </button>
      )}
      <datalist id={TIME_LIST_ID}>
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
};

export default SchedulesManagerDialog;
