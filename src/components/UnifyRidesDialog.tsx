import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers, Bike } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MotoboyAssignment } from '@/hooks/useSupabaseDepartmental';
import { cn } from '@/lib/utils';

interface UnifyRidesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: MotoboyAssignment[];
  currentUserId: string;
  getName: (id: string) => string;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Unification rule:
 *  - If all selected rides are exactly R$ 15: result is R$ 15
 *  - Otherwise: max(values) + 15 * (n - 1)
 */
function calculateUnifiedValue(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const max = Math.max(...values);
  if (max <= 15) return 15;
  return max + 15 * (values.length - 1);
}

const UnifyRidesDialog = ({
  open,
  onOpenChange,
  assignments,
  currentUserId,
  getName,
}: UnifyRidesDialogProps) => {
  const [selectedMotoboy, setSelectedMotoboy] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Group eligible assignments (not unified yet) by motoboy + date
  const groups = useMemo(() => {
    const map = new Map<string, { motoboyId: string; date: string; rides: MotoboyAssignment[] }>();
    for (const a of assignments) {
      if (a.status === 'pending_approval') continue;
      if (!a.assignedTo || a.assignedTo === 'pending') continue;
      const date = a.createdAt.split('T')[0];
      const key = `${a.assignedTo}__${date}`;
      if (!map.has(key)) map.set(key, { motoboyId: a.assignedTo, date, rides: [] });
      map.get(key)!.rides.push(a);
    }
    // Only show groups with at least 2 rides (unification needs 2+)
    return Array.from(map.values())
      .filter((g) => g.rides.length >= 2)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [assignments]);

  const groupKey = selectedMotoboy && selectedDate ? `${selectedMotoboy}__${selectedDate}` : '';
  const currentGroup = groups.find((g) => `${g.motoboyId}__${g.date}` === groupKey);
  const ridesInGroup = currentGroup?.rides || [];

  const selectedRides = ridesInGroup.filter((r) => selectedIds.has(r.id));
  const unifiedValue = calculateUnifiedValue(selectedRides.map((r) => r.rideValue || 0));

  const reset = () => {
    setSelectedMotoboy('');
    setSelectedDate('');
    setSelectedIds(new Set());
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUnify = async () => {
    if (selectedRides.length < 2 || !currentGroup) return;
    setSubmitting(true);
    try {
      const descriptions = selectedRides.map((r) => r.clientName || r.description).filter(Boolean);
      const unifiedDesc = `🔗 Unificada: ${descriptions.join(' + ')}`;
      const unifiedClient =
        selectedRides
          .map((r) => r.clientName)
          .filter(Boolean)
          .join(' + ') || '';
      const unifiedLocation =
        Array.from(new Set(selectedRides.map((r) => r.location).filter(Boolean))).join(' | ') || '';
      const unifiedNotes = `Unificada de ${selectedRides.length} corridas`;
      const allCompleted = selectedRides.every((r) => r.status === 'completed');
      const now = new Date().toISOString();

      // ----- Unify the related Kanban tasks (Meu Quadro do motoboy) -----
      const originalTaskIds = selectedRides
        .map((r) => (r as any).taskId)
        .filter(Boolean) as string[];
      let unifiedTaskId: string | null = null;

      if (!allCompleted) {
        // Fetch originals to derive priority/deadline/status
        let baseTasks: any[] = [];
        if (originalTaskIds.length > 0) {
          const { data: ts } = await supabase.from('tasks').select('*').in('id', originalTaskIds);
          baseTasks = ts || [];
        }
        // Highest priority wins (high > medium > low)
        const priorityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const priority =
          baseTasks.length > 0
            ? baseTasks.reduce(
                (acc, t) =>
                  (priorityRank[t.priority] || 0) > (priorityRank[acc] || 0) ? t.priority : acc,
                'medium'
              )
            : 'medium';
        // Earliest deadline wins
        const deadline =
          baseTasks.length > 0
            ? baseTasks.reduce(
                (acc, t) => (!acc || (t.deadline && t.deadline < acc) ? t.deadline : acc),
                '' as string
              )
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        // Preserve current column if all originals share it; otherwise reset to todo
        const statuses = Array.from(new Set(baseTasks.map((t) => t.status)));
        const taskStatus = statuses.length === 1 ? statuses[0] : 'todo';

        const { data: newTask, error: taskInsertErr } = await supabase
          .from('tasks')
          .insert({
            title: `🔗 Corrida unificada (${selectedRides.length}) — ${unifiedClient.slice(0, 80) || 'Motoboy'}`,
            description: `Corrida unificada de ${selectedRides.length} entregas:\n\n${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}${unifiedLocation ? `\n\n📍 ${unifiedLocation}` : ''}\n\n💰 Valor: ${formatCurrency(unifiedValue)}`,
            status: taskStatus,
            priority,
            assignee_id: currentGroup.motoboyId,
            created_by: currentUserId,
            deadline,
            sector: 'motoboys',
            status_history: [{ status: taskStatus, enteredAt: now }] as any,
          })
          .select('id')
          .single();

        if (taskInsertErr) throw taskInsertErr;
        unifiedTaskId = newTask?.id || null;

        // Delete the original Kanban tasks so they collapse into the unified one
        if (originalTaskIds.length > 0) {
          await supabase.from('tasks').delete().in('id', originalTaskIds);
        }
      }

      // Derive ride status from the (possibly inherited) task status so the
      // unified ride mirrors the column its task lives in on the motoboy's board.
      const taskStatusForRide = allCompleted
        ? 'done'
        : // Re-read computed taskStatus from above scope by recomputing quickly
          (() => {
            // If we just created a unified task, its status was set to taskStatus
            // (todo|in_progress|paused|done). Default to 'todo' when no task was created.
            return null;
          })();
      const rideStatusMap: Record<string, string> = {
        todo: 'pending',
        in_progress: 'accepted',
        paused: 'accepted',
        done: 'completed',
      };
      // We need taskStatus value; recompute from selectedRides+baseTasks isn't necessary —
      // when allCompleted=true ride is 'completed'; otherwise the unified task we just inserted
      // carries `taskStatus`. Re-fetch it briefly:
      let finalRideStatus = 'pending';
      if (allCompleted) finalRideStatus = 'completed';
      else if (unifiedTaskId) {
        const { data: t } = await supabase
          .from('tasks')
          .select('status')
          .eq('id', unifiedTaskId)
          .single();
        finalRideStatus = rideStatusMap[t?.status || 'todo'] || 'pending';
      }

      // Insert new unified ride (linked to the unified task when applicable)
      const { error: insertErr } = await supabase.from('motoboy_assignments').insert({
        description: unifiedDesc,
        assigned_to: currentGroup.motoboyId,
        assigned_by: currentUserId,
        ride_value: unifiedValue,
        client_name: unifiedClient.slice(0, 200),
        location: unifiedLocation.slice(0, 200),
        notes: unifiedNotes,
        status: finalRideStatus,
        accepted_at:
          finalRideStatus === 'accepted' || finalRideStatus === 'completed'
            ? selectedRides[0].acceptedAt || now
            : null,
        completed_at: finalRideStatus === 'completed' ? now : null,
        created_at: selectedRides[0].createdAt,
        task_id: unifiedTaskId,
      } as any);

      if (insertErr) throw insertErr;

      // Delete originals
      const ids = selectedRides.map((r) => r.id);
      const { error: delErr } = await supabase.from('motoboy_assignments').delete().in('id', ids);
      if (delErr) throw delErr;

      toast.success(
        `${selectedRides.length} corridas unificadas em uma de ${formatCurrency(unifiedValue)}`
      );
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao unificar corridas:', err);
      toast.error(`Erro ao unificar: ${err?.message || 'Tente novamente'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Build distinct motoboys from groups
  const motoboyOptions = useMemo(() => {
    const ids = Array.from(new Set(groups.map((g) => g.motoboyId)));
    return ids.map((id) => ({ id, name: getName(id) }));
  }, [groups, getName]);

  // Available dates for selected motoboy
  const dateOptions = useMemo(() => {
    if (!selectedMotoboy) return [];
    return groups.filter((g) => g.motoboyId === selectedMotoboy).map((g) => g.date);
  }, [groups, selectedMotoboy]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4" /> Unificar Corridas
          </DialogTitle>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum motoboy possui 2+ corridas no mesmo dia disponíveis para unificação.
          </p>
        ) : (
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Motoboy</label>
              <Select
                value={selectedMotoboy}
                onValueChange={(v) => {
                  setSelectedMotoboy(v);
                  setSelectedDate('');
                  setSelectedIds(new Set());
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um motoboy" />
                </SelectTrigger>
                <SelectContent>
                  {motoboyOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMotoboy && (
              <div>
                <label className="text-xs font-medium mb-1 block">Dia</label>
                <Select
                  value={selectedDate}
                  onValueChange={(v) => {
                    setSelectedDate(v);
                    setSelectedIds(new Set());
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateOptions.map((d) => {
                      const [y, m, day] = d.split('-');
                      return <SelectItem key={d} value={d}>{`${day}/${m}/${y}`}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {ridesInGroup.length > 0 && (
              <div>
                <label className="text-xs font-medium mb-1.5 block">
                  Selecione as corridas para unificar
                </label>
                <div className="space-y-1.5 max-h-64 overflow-y-auto border border-border rounded-md p-2">
                  {ridesInGroup.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        'flex items-center gap-2 text-xs p-2 rounded cursor-pointer transition-colors',
                        selectedIds.has(r.id)
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-secondary/40 hover:bg-secondary/60 border border-transparent'
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.has(r.id)}
                        onCheckedChange={() => toggle(r.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Bike className="w-3 h-3 text-primary shrink-0" />
                          <span className="font-medium truncate">
                            {r.clientName || r.description}
                          </span>
                        </div>
                        {r.location && (
                          <p className="text-muted-foreground truncate">📍 {r.location}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(r.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' • '}
                          Status:{' '}
                          {r.status === 'completed' ? '✅' : r.status === 'accepted' ? '🛵' : '⏳'}
                        </p>
                      </div>
                      <span className="font-bold text-primary shrink-0">
                        {formatCurrency(r.rideValue || 0)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedRides.length >= 2 && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Resultado:</p>
                <p className="text-sm font-semibold">
                  {selectedRides.length} corridas → 1 corrida de{' '}
                  <span className="text-primary text-base">{formatCurrency(unifiedValue)}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  As corridas originais serão substituídas pela nova corrida unificada.
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleUnify}
              disabled={selectedRides.length < 2 || submitting}
            >
              {submitting
                ? 'Unificando...'
                : `Unificar ${selectedRides.length || ''} corrida${selectedRides.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UnifyRidesDialog;
