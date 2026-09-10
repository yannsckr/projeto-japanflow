import { useState, useMemo } from 'react';
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
import { CalendarEvent } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CalendarDays, Clock, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AICalendarCreator from '@/components/AICalendarCreator';

interface EmployeeCalendarProps {
  userId: string;
}

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

const EmployeeCalendar = ({ userId }: EmployeeCalendarProps) => {
  const {
    currentUser,
    getEventsForUser,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    users,
  } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [eventType, setEventType] = useState<'event' | 'reminder'>('event');

  const isAdmin = currentUser?.role === 'admin';
  const events = getEventsForUser(userId);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const eventsForDate = events.filter((e) => e.date === selectedDateStr);

  // Group dates by their dominant color for calendar modifiers
  const { reminderDates, allDates, sectorDates, specificDates } = useMemo(() => {
    const reminder: Date[] = [];
    const all: Date[] = [];
    const sector: Date[] = [];
    const specific: Date[] = [];
    const seen = {
      reminder: new Set<string>(),
      all: new Set<string>(),
      sector: new Set<string>(),
      specific: new Set<string>(),
    };

    events.forEach((e) => {
      const dateStr = e.date;
      if (e.type === 'reminder' && !seen.reminder.has(dateStr)) {
        seen.reminder.add(dateStr);
        reminder.push(new Date(dateStr + 'T12:00:00'));
      } else if (e.targetMode === 'all' && !seen.all.has(dateStr)) {
        seen.all.add(dateStr);
        all.push(new Date(dateStr + 'T12:00:00'));
      } else if (e.targetMode === 'sector' && !seen.sector.has(dateStr)) {
        seen.sector.add(dateStr);
        sector.push(new Date(dateStr + 'T12:00:00'));
      } else if (
        e.targetMode === 'specific' &&
        e.type !== 'reminder' &&
        !seen.specific.has(dateStr)
      ) {
        seen.specific.add(dateStr);
        specific.push(new Date(dateStr + 'T12:00:00'));
      }
    });
    return { reminderDates: reminder, allDates: all, sectorDates: sector, specificDates: specific };
  }, [events]);

  const canEditEvent = (event: CalendarEvent) => {
    if (isAdmin) return true;
    return event.createdBy === currentUser?.id;
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

    if (editingEvent) {
      updateCalendarEvent(editingEvent.id, {
        title: title.trim(),
        description: description.trim(),
        date: selectedDateStr,
        time: time || undefined,
        type: eventType,
      });
      toast.success('Evento atualizado');
    } else {
      addCalendarEvent({
        title: title.trim(),
        description: description.trim(),
        date: selectedDateStr,
        time: time || undefined,
        userId,
        createdBy: currentUser!.id,
        type: eventType,
        targetMode: 'specific',
        targetUsers: [userId],
      });
      toast.success('Evento criado');
    }
    resetForm();
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    setTime(event.time || '');
    setEventType(event.type);
    setShowAddDialog(true);
  };

  const handleDelete = (eventId: string) => {
    deleteCalendarEvent(eventId);
    toast.success('Evento removido');
  };

  const resetForm = () => {
    setShowAddDialog(false);
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setTime('');
    setEventType('event');
  };

  const getCreatorName = (createdBy: string) => {
    return users.find((u) => u.id === createdBy)?.name || 'Desconhecido';
  };

  const getParticipantNames = (targetUsers: string[]) => {
    if (!targetUsers || targetUsers.length === 0) return '';
    return targetUsers
      .map((id) => users.find((u) => u.id === id)?.name || 'Desconhecido')
      .join(', ');
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Calendário
        </h3>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-shrink-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            className="p-3 pointer-events-auto rounded-lg border border-border"
            modifiers={{
              reminder: reminderDates,
              eventAll: allDates,
              eventSector: sectorDates,
              eventSpecific: specificDates,
            }}
            modifiersClassNames={{
              reminder: 'bg-yellow-200 dark:bg-yellow-800/40 font-bold',
              eventAll: 'bg-red-200 dark:bg-red-800/40 font-bold',
              eventSector: 'bg-blue-200 dark:bg-blue-800/40 font-bold',
              eventSpecific: 'bg-green-200 dark:bg-green-800/40 font-bold',
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">
              {selectedDate
                ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'}
            </p>
            <div className="flex items-center gap-2">
              <AICalendarCreator />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowAddDialog(true);
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Novo
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
                    className={cn(
                      'border rounded-lg p-3 text-sm text-gray-900 dark:text-gray-950',
                      colors.border,
                      colors.bg
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', colors.dot)} />
                          {event.type === 'reminder' ? (
                            <Bell className="w-3 h-3 text-gray-900 dark:text-gray-950" />
                          ) : (
                            <CalendarDays className="w-3 h-3 text-gray-900 dark:text-gray-950" />
                          )}
                          <span className="font-semibold truncate text-gray-900 dark:text-gray-950">
                            {event.title}
                          </span>
                        </div>
                        {event.time && (
                          <p className="text-xs text-gray-800 dark:text-gray-900 flex items-center gap-1 mt-1 font-medium">
                            <Clock className="w-3 h-3" />
                            {event.time}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-xs text-gray-800 dark:text-gray-900 mt-1">
                            {event.description}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-700 dark:text-gray-800 mt-1">
                          Por: {getCreatorName(event.createdBy)}
                        </p>
                        {event.targetUsers && event.targetUsers.length > 1 && (
                          <p className="text-[10px] text-gray-700 dark:text-gray-800">
                            Participantes: {getParticipantNames(event.targetUsers)}
                          </p>
                        )}
                      </div>
                      {canEditEvent(event) && (
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-gray-900 dark:text-gray-950 hover:bg-black/10"
                            onClick={() => handleEdit(event)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-700 hover:bg-black/10 hover:text-red-800"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>Lembrete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span>Empresa (geral)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-400" />
          <span>Setor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-400" />
          <span>Individual</span>
        </div>
      </div>

      <Dialog
        open={showAddDialog}
        onOpenChange={(v) => {
          if (!v) resetForm();
          else setShowAddDialog(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
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
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>{editingEvent ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeCalendar;
