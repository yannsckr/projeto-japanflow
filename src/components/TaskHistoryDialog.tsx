import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Task, PRIORITY_LABELS, STATUS_LABELS, SECTOR_LABELS } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Search, Clock, CheckCircle2, User, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactivateTaskDialog from './ReactivateTaskDialog';

interface TaskHistoryDialogProps {
  userId?: string;
}

const TaskHistoryDialog = ({ userId }: TaskHistoryDialogProps) => {
  const { tasks, users } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [reactivateTask, setReactivateTask] = useState<Task | null>(null);

  const completedTasks = useMemo(() => {
    let filtered = tasks.filter((t) => {
      if (t.status !== 'done') return false;
      if (userId && t.assigneeId !== userId) return false;
      return true;
    });

    // Filter by period
    if (filterPeriod !== 'all') {
      const now = Date.now();
      const periods: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const ms = periods[filterPeriod];
      if (ms) {
        filtered = filtered.filter((t) => {
          const doneEntry = t.statusHistory?.filter((h) => h.status === 'done').pop();
          if (!doneEntry) return false;
          return now - new Date(doneEntry.enteredAt).getTime() <= ms;
        });
      }
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }

    // Sort by completion date (most recent first)
    return filtered.sort((a, b) => {
      const aDone = a.statusHistory?.filter((h) => h.status === 'done').pop();
      const bDone = b.statusHistory?.filter((h) => h.status === 'done').pop();
      const aTime = aDone ? new Date(aDone.enteredAt).getTime() : 0;
      const bTime = bDone ? new Date(bDone.enteredAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [tasks, userId, filterPeriod, search]);

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString('pt-BR') +
      ' às ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    );
  };

  const getDuration = (task: Task) => {
    const created = new Date(task.createdAt).getTime();
    const doneEntry = task.statusHistory?.filter((h) => h.status === 'done').pop();
    if (!doneEntry) return '—';
    const completed = new Date(doneEntry.enteredAt).getTime();
    const diff = completed - created;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Tarefas Concluídas
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[55vh]">
          {completedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma tarefa concluída encontrada</p>
            </div>
          ) : (
            <div className="space-y-2 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {completedTasks.length} tarefa{completedTasks.length !== 1 ? 's' : ''} concluída
                {completedTasks.length !== 1 ? 's' : ''}
              </p>
              {completedTasks.map((task) => {
                const assignee = users.find((u) => u.id === task.assigneeId);
                const doneEntry = task.statusHistory?.filter((h) => h.status === 'done').pop();
                return (
                  <div
                    key={task.id}
                    className="bg-secondary/30 border border-border rounded-lg p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold">{task.title}</h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                            `priority-badge-${task.priority}`
                          )}
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] gap-1"
                          onClick={() => setReactivateTask(task)}
                          title="Reativar e encaminhar"
                        >
                          <RotateCcw className="w-3 h-3" /> Reativar
                        </Button>
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                      {!userId && assignee && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {assignee.name}
                        </span>
                      )}
                      {task.sector && <span>📋 {SECTOR_LABELS[task.sector]}</span>}
                      {doneEntry && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-success" />
                          {formatDateTime(doneEntry.enteredAt)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Duração: {getDuration(task)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
      {reactivateTask && (
        <ReactivateTaskDialog
          task={reactivateTask}
          open={!!reactivateTask}
          onOpenChange={(o) => {
            if (!o) setReactivateTask(null);
          }}
          onReactivated={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
};

export default TaskHistoryDialog;
