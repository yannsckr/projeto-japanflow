import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Priority, Sector, SECTOR_LABELS, PRIORITY_LABELS } from '@/types';

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const toIso = (value: any): string | null => {
  if (!value) return null;

  if (value?.toDate) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
};

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

  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  // Firestore em tempo real
  useEffect(() => {
    const schedulesQuery = query(collection(db, 'scheduled_tasks'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const nextSchedules: ScheduledTask[] = snapshot.docs.map((scheduleDoc) => {
          const data = scheduleDoc.data();

          return {
            id: scheduleDoc.id,
            title: data.title || '',
            description: data.description || '',
            priority: data.priority || 'medium',
            assignee_id: data.assignee_id || null,
            sector: data.sector || null,
            assign_mode: data.assign_mode || 'employee',
            schedule_time: data.schedule_time || '08:00',
            recurrence: data.recurrence || 'daily',

            days_of_week: Array.isArray(data.days_of_week) ? data.days_of_week : [],

            active: data.active !== false,

            created_by: data.created_by || '',

            created_at: toIso(data.created_at) || new Date().toISOString(),

            last_created_at: toIso(data.last_created_at),
          };
        });

        setSchedules(nextSchedules);
      },
      (error) => {
        console.error('Erro ao acompanhar tarefas agendadas:', error);

        toast.error('Erro ao carregar tarefas agendadas');
      }
    );

    return () => unsubscribe();
  }, []);

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

      updated_at: Timestamp.now(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'scheduled_tasks', editingId), payload);

        toast.success('Agendamento atualizado');
      } else {
        await addDoc(collection(db, 'scheduled_tasks'), {
          ...payload,

          active: true,

          created_at: Timestamp.now(),

          last_created_at: null,
        });

        toast.success('Agendamento criado');
      }

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);

      toast.error(editingId ? 'Erro ao atualizar' : 'Erro ao criar agendamento');
    }
  };

  const handleEdit = (schedule: ScheduledTask) => {
    setEditingId(schedule.id);

    setTitle(schedule.title);
    setDescription(schedule.description);

    setPriority(schedule.priority as Priority);

    setAssignMode(schedule.assign_mode as 'employee' | 'sector');

    setAssigneeId(schedule.assignee_id || '');

    setSector((schedule.sector || '') as Sector | '');

    setScheduleTime(schedule.schedule_time);

    setRecurrence(schedule.recurrence as 'daily' | 'specific_days');

    setDaysOfWeek(schedule.days_of_week || [1, 2, 3, 4, 5]);

    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'scheduled_tasks', id));

      toast.success('Agendamento excluído');
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);

      toast.error('Erro ao excluir');
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'scheduled_tasks', id), {
        active: !active,
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erro ao alterar agendamento:', error);

      toast.error('Erro ao atualizar');
    }
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day)
        ? prev.filter((currentDay) => currentDay !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const getAssigneeName = (schedule: ScheduledTask) => {
    if (schedule.assign_mode === 'sector') {
      return SECTOR_LABELS[schedule.sector as Sector] || schedule.sector;
    }

    const user = users.find((u) => u.id === schedule.assignee_id);

    return user?.name || 'Desconhecido';
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  return (
    <section className="jf-surface min-w-0 space-y-4 overflow-hidden p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Automação
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="w-5 h-5" />
            Tarefas Agendadas
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie tarefas automáticas por horário e recorrência.
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);

            if (!value) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Novo Agendamento
            </Button>
          </DialogTrigger>

          <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto rounded-2xl sm:w-full">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Editar Agendamento' : 'Novo Agendamento Automático'}
              </DialogTitle>
              <DialogDescription>
                Defina a atribuição, horário e recorrência da tarefa automática.
              </DialogDescription>
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

                  <Select
                    value={priority}
                    onValueChange={(value) => setPriority(value as Priority)}
                  >
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
                  onValueChange={(value) => setAssignMode(value as 'employee' | 'sector')}
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
                          .filter(
                            (u) =>
                              (u.role === 'employee' || u.role === 'admin') && u.active !== false
                          )
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>

                  <TabsContent value="sector" className="mt-2">
                    <Select value={sector} onValueChange={(value) => setSector(value as Sector)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>

                      <SelectContent>
                        {(Object.keys(SECTOR_LABELS) as Sector[]).map((sectorKey) => (
                          <SelectItem key={sectorKey} value={sectorKey}>
                            {SECTOR_LABELS[sectorKey]}
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
                  onValueChange={(value) => setRecurrence(value as 'daily' | 'specific_days')}
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
                    {DAY_LABELS.map((label, index) => (
                      <Button
                        key={index}
                        type="button"
                        size="sm"
                        variant={daysOfWeek.includes(index) ? 'default' : 'outline'}
                        className="h-9 w-11 text-xs"
                        onClick={() => toggleDay(index)}
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
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`jf-interactive flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                schedule.active ? 'bg-card' : 'bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{schedule.title}</span>

                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {PRIORITY_LABELS[schedule.priority as Priority] || schedule.priority}
                  </Badge>

                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {schedule.schedule_time}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>→ {getAssigneeName(schedule)}</span>
                  {schedule.last_created_at && (
                    <span>
                      • Última criação: {new Date(schedule.last_created_at).toLocaleString('pt-BR')}
                    </span>
                  )}

                  <span>•</span>

                  <span>
                    {schedule.recurrence === 'daily'
                      ? 'Todos os dias'
                      : (schedule.days_of_week || []).map((day) => DAY_LABELS[day]).join(', ')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleToggle(schedule.id, schedule.active)}
                  title={schedule.active ? 'Desativar' : 'Ativar'}
                >
                  {schedule.active ? (
                    <Power className="w-4 h-4 text-green-500" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleEdit(schedule)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(schedule.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ScheduledTasksManager;
