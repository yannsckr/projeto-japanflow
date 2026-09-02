import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Sector, SECTOR_LABELS } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock, Bell, Users, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CalendarEvent } from '@/types';
import AICalendarCreator from '@/components/AICalendarCreator';

type TargetMode = 'all' | 'sector' | 'specific';

const getEventColor = (event: CalendarEvent) => {
  if (event.type === 'reminder')
    return {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      border: 'border-yellow-400',
      text: 'text-yellow-700 dark:text-yellow-300',
      dot: 'bg-yellow-400',
    };
  if (event.targetMode === 'all')
    return {
      bg: 'bg-red-100 dark:bg-red-900/30',
      border: 'border-red-400',
      text: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-400',
    };
  if (event.targetMode === 'sector')
    return {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      border: 'border-blue-400',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-400',
    };
  return {
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-400',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-400',
  };
};

const AdminCalendarView = () => {
  const { currentUser, calendarEvents, users, addCalendarEvent, deleteCalendarEvent } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showDialog, setShowDialog] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [eventType, setEventType] = useState<'event' | 'reminder'>('event');
  const [targetMode, setTargetMode] = useState<TargetMode>('all');
  const [selectedSector, setSelectedSector] = useState<Sector | ''>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const eventsForDate = calendarEvents.filter((e) => e.date === selectedDateStr);
  const datesWithEvents = calendarEvents.map((e) => new Date(e.date + 'T12:00:00'));

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || 'Desconhecido';

  const getParticipantNames = (targetUsers: string[]) => {
    if (!targetUsers || targetUsers.length === 0) return '';
    return targetUsers.map((id) => getUserName(id)).join(', ');
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const resetForm = () => {
    setShowDialog(false);
    setTitle('');
    setDescription('');
    setTime('');
    setEventType('event');
    setTargetMode('all');
    setSelectedSector('');
    setSelectedUserIds([]);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Informe o título');
      return;
    }
    if (!selectedDateStr) {
      toast.error('Selecione uma data');
      return;
    }
    if (!currentUser) return;

    let targetUserIds: string[] = [];

    if (targetMode === 'all') {
      targetUserIds = users.map((u) => u.id);
    } else if (targetMode === 'sector') {
      if (!selectedSector) {
        toast.error('Selecione um setor');
        return;
      }
      targetUserIds = users
        .filter((u) => u.sectors?.includes(selectedSector as Sector) || u.role === 'admin')
        .map((u) => u.id);
      if (currentUser && !targetUserIds.includes(currentUser.id)) {
        targetUserIds.push(currentUser.id);
      }
    } else {
      if (selectedUserIds.length === 0) {
        toast.error('Selecione ao menos um usuário');
        return;
      }
      targetUserIds = [...selectedUserIds];
    }

    // Create ONE event with all target users
    addCalendarEvent({
      title: title.trim(),
      description: description.trim(),
      date: selectedDateStr,
      time: time || undefined,
      userId: currentUser.id,
      createdBy: currentUser.id,
      type: eventType,
      targetMode: targetMode,
      targetUsers: targetUserIds,
    });

    toast.success(`Evento criado para ${targetUserIds.length} usuário(s)`);
    resetForm();
  };

  const handleDelete = (eventId: string) => {
    deleteCalendarEvent(eventId);
    toast.success('Evento removido');
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Calendário Global da Equipe</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {calendarEvents.length} evento(s)
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-shrink-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            className="p-3 pointer-events-auto rounded-lg border border-border"
            modifiers={{ hasEvent: datesWithEvents }}
            modifiersClassNames={{ hasEvent: 'bg-primary/20 font-bold' }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">
              {selectedDate
                ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'}
            </p>
            <div className="flex gap-2">
              <AICalendarCreator />
              <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
                <Plus className="w-3 h-3 mr-1" />
                Novo Evento
              </Button>
            </div>
          </div>

          {eventsForDate.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum evento nesta data
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {eventsForDate.map((event) => {
                const colors = getEventColor(event);
                return (
                  <div
                    key={event.id}
                    className={cn('border rounded-lg p-3 text-sm', colors.border, colors.bg)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', colors.dot)} />
                          {event.type === 'reminder' ? (
                            <Bell className={cn('w-3 h-3', colors.text)} />
                          ) : (
                            <CalendarDays className={cn('w-3 h-3', colors.text)} />
                          )}
                          <span className="font-medium truncate">{event.title}</span>
                        </div>
                        {event.time && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {event.time}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                        )}
                        <div className="mt-1.5 text-[10px] text-muted-foreground/60 space-y-0.5">
                          <p>Criado por: {getUserName(event.createdBy)}</p>
                          {event.targetUsers && event.targetUsers.length > 0 && (
                            <p>Participantes: {getParticipantNames(event.targetUsers)}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-xs text-muted-foreground">Lembrete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-xs text-muted-foreground">Toda a Empresa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-xs text-muted-foreground">Por Setor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-400" />
          <span className="text-xs text-muted-foreground">Específico</span>
        </div>
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(v) => {
          if (!v) resetForm();
          else setShowDialog(true);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Evento / Lembrete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
            />

            <div className="flex gap-3">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-32"
              />
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v as 'event' | 'reminder')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Evento</SelectItem>
                  <SelectItem value="reminder">Lembrete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              Data: {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Não selecionada'}
            </p>

            <div className="space-y-3">
              <p className="text-sm font-medium">Destinatários</p>
              <Select value={targetMode} onValueChange={(v) => setTargetMode(v as TargetMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="sector">Por Setor</SelectItem>
                  <SelectItem value="specific">Usuários específicos</SelectItem>
                </SelectContent>
              </Select>

              {targetMode === 'sector' && (
                <Select
                  value={selectedSector}
                  onValueChange={(v) => setSelectedSector(v as Sector)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SECTOR_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {targetMode === 'specific' && (
                <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {users.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum usuário cadastrado</p>
                  ) : (
                    users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 rounded p-1.5 -mx-1.5"
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        />
                        <span className="text-sm">{user.name}</span>
                        {user.sectors?.length > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {user.sectors.map((s) => SECTOR_LABELS[s]).join(', ')}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCalendarView;
