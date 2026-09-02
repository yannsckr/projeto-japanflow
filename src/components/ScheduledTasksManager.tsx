import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Priority, Sector, SECTOR_LABELS, PRIORITY_LABELS } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Plus, Trash2, Pencil, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  assignee_id: string | null;
  sector: string | null;
  assign_mode: string;
  schedule_time: string;
  recurrence: string;
  days_of_week: number[];
  active: boolean;
  created_by: string;
  created_at: string;
  last_created_at: string | null;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ScheduledTasksManager = () => {
  const { currentUser, users } = useApp();
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignMode, setAssignMode] = useState<'employee' | 'sector'>('employee');
  const [assigneeId, setAssigneeId] = useState('');
  const [sector, setSector] = useState<Sector | ''>('');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [recurrence, setRecurrence] = useState<'daily' | 'specific_days'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri

  const fetchSchedules = useCallback(async () => {
    const { data } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setSchedules(data as unknown as ScheduledTask[]);
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setAssignMode('employee');
    setAssigneeId('');
    setSector('');
    setScheduleTime('08:00');
    setRecurrence('daily');
    setDaysOfWeek([1, 2, 3, 4, 5]);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !currentUser) return;
    if (assignMode === 'employee' && !assigneeId) {
      toast.error('Selecione um funcionário');
      return;
    }
    if (assignMode === 'sector' && !sector) {
      toast.error('Selecione um setor');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      assign_mode: assignMode,
      assignee_id: assignMode === 'employee' ? assigneeId : null,
      sector: assignMode === 'sector' ? sector : null,
      schedule_time: scheduleTime,
      recurrence,
      days_of_week: recurrence === 'specific_days' ? daysOfWeek : [],
      created_by: currentUser.id,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('scheduled_tasks').update(payload).eq('id', editingId);
      if (error) {
        toast.error('Erro ao atualizar');
        return;
      }
      toast.success('Agendamento atualizado');
    } else {
      const { error } = await supabase.from('scheduled_tasks').insert(payload);
      if (error) {
        toast.error('Erro ao criar agendamento');
        return;
      }
      toast.success('Agendamento criado');
    }

    resetForm();
    setOpen(false);
    fetchSchedules();
  };

  const handleEdit = (s: ScheduledTask) => {
    setEditingId(s.id);
    setTitle(s.title);
    setDescription(s.description);
    setPriority(s.priority as Priority);
    setAssignMode(s.assign_mode as 'employee' | 'sector');
    setAssigneeId(s.assignee_id || '');
    setSector((s.sector || '') as Sector | '');
    setScheduleTime(s.schedule_time);
    setRecurrence(s.recurrence as 'daily' | 'specific_days');
    setDaysOfWeek(s.days_of_week || [1, 2, 3, 4, 5]);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('scheduled_tasks').delete().eq('id', id);
    toast.success('Agendamento excluído');
    fetchSchedules();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase
      .from('scheduled_tasks')
      .update({ active: !active, updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchSchedules();
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const getAssigneeName = (s: ScheduledTask) => {
    if (s.assign_mode === 'sector') return SECTOR_LABELS[s.sector as Sector] || s.sector;
    const user = users.find((u) => u.id === s.assignee_id);
    return user?.name || 'Desconhecido';
  };

  if (!currentUser || currentUser.role !== 'admin') return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarClock className="w-5 h-5" />
          Tarefas Agendadas
        </h3>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Editar Agendamento' : 'Novo Agendamento Automático'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium">Título da Tarefa</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Conferir estoque"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição da tarefa..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Horário</label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Atribuir para</label>
                <Tabs
                  value={assignMode}
                  onValueChange={(v) => setAssignMode(v as 'employee' | 'sector')}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="employee" className="flex-1">
                      Funcionário
                    </TabsTrigger>
                    <TabsTrigger value="sector" className="flex-1">
                      Setor
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="employee" className="mt-2">
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((u) => u.role === 'employee' || u.role === 'admin')
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                  <TabsContent value="sector" className="mt-2">
                    <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {SECTOR_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <label className="text-sm font-medium">Recorrência</label>
                <Select
                  value={recurrence}
                  onValueChange={(v) => setRecurrence(v as 'daily' | 'specific_days')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Todos os dias</SelectItem>
                    <SelectItem value="specific_days">Dias específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrence === 'specific_days' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Dias da semana</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map((label, i) => (
                      <Button
                        key={i}
                        type="button"
                        size="sm"
                        variant={daysOfWeek.includes(i) ? 'default' : 'outline'}
                        className="h-9 w-11 text-xs"
                        onClick={() => toggleDay(i)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={handleSave} disabled={!title.trim()}>
                {editingId ? 'Salvar Alterações' : 'Criar Agendamento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum agendamento automático configurado.
        </p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${s.active ? 'bg-card' : 'bg-muted/50 opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{s.title}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {PRIORITY_LABELS[s.priority as Priority] || s.priority}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {s.schedule_time}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>→ {getAssigneeName(s)}</span>
                  <span>•</span>
                  <span>
                    {s.recurrence === 'daily'
                      ? 'Todos os dias'
                      : (s.days_of_week || []).map((d: number) => DAY_LABELS[d]).join(', ')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleToggle(s.id, s.active)}
                  title={s.active ? 'Desativar' : 'Ativar'}
                >
                  {s.active ? (
                    <Power className="w-4 h-4 text-green-500" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleEdit(s)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(s.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduledTasksManager;
