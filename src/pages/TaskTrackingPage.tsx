import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Task, STATUS_LABELS, PRIORITY_LABELS, Sector, SECTOR_LABELS } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Package,
  Bike,
  Mail,
  Clock,
  User,
  CheckCircle2,
  Circle,
  Loader2,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TaskDetailDialog from '@/components/TaskDetailDialog';

interface MotoboyAssignment {
  id: string;
  description: string;
  assigned_to: string;
  status: string;
  client_name: string;
  location: string;
  ride_value: number;
  notes: string;
  created_at: string;
  completed_at: string | null;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  todo: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <Loader2 className="w-4 h-4 text-warning animate-spin" />,
  paused: <Pause className="w-4 h-4 text-muted-foreground" />,
  done: <CheckCircle2 className="w-4 h-4 text-success" />,
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-primary/10 text-primary border-primary/20',
  in_progress: 'bg-warning/10 text-warning border-warning/20',
  paused: 'bg-muted text-muted-foreground border-border',
  done: 'bg-success/10 text-success border-success/20',
  pending: 'bg-primary/10 text-primary border-primary/20',
  pending_approval: 'bg-warning/10 text-warning border-warning/20',
  accepted: 'bg-accent/50 text-accent-foreground border-accent',
  completed: 'bg-success/10 text-success border-success/20',
};

const RIDE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  pending_approval: 'Aguardando Aprovação',
  accepted: 'Aceita',
  completed: 'Concluída',
};

const TaskTrackingPage = () => {
  const { currentUser, tasks, users } = useApp();
  const [search, setSearch] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [rides, setRides] = useState<MotoboyAssignment[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  // Fetch rides created by this user
  useEffect(() => {
    if (!currentUser) return;
    const fetchRides = async () => {
      const { data } = await supabase
        .from('motoboy_assignments')
        .select('*')
        .eq('assigned_by', currentUser.id)
        .order('created_at', { ascending: false });
      if (data) setRides(data as MotoboyAssignment[]);
    };
    fetchRides();

    const channel = supabase
      .channel('tracking-rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'motoboy_assignments' },
        () => {
          fetchRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Tasks created by current user for others
  const createdTasks = useMemo(() => {
    if (!currentUser) return [];
    return tasks.filter((t) => t.createdBy === currentUser.id && t.assigneeId !== currentUser.id);
  }, [tasks, currentUser]);

  // Find related sub-tasks for a given task (by title matching)
  const getRelatedItems = (task: Task) => {
    const related: { type: 'task' | 'ride'; item: Task | MotoboyAssignment }[] = [];

    // Find etiqueta tasks created for this task
    const etiquetaTasks = tasks.filter(
      (t) =>
        t.id !== task.id &&
        t.createdBy === currentUser?.id &&
        (t.title.includes(task.title) || t.description.includes(task.title)) &&
        t.title.includes('Etiqueta')
    );
    etiquetaTasks.forEach((t) => related.push({ type: 'task', item: t }));

    // Find rides related to this task
    const relatedRides = rides.filter(
      (r) => r.description.includes(task.title) || r.description.includes('Entrega')
    );
    // Only match rides that have a meaningful connection
    if (task.title && relatedRides.length > 0) {
      const exactMatches = relatedRides.filter((r) => r.description.includes(task.title));
      exactMatches.forEach((r) => related.push({ type: 'ride', item: r }));
    }

    return related;
  };

  // Filter and search
  const filteredTasks = useMemo(() => {
    let result = createdTasks;
    if (filter === 'active') result = result.filter((t) => t.status !== 'done');
    if (filter === 'done') result = result.filter((t) => t.status === 'done');
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((t) => {
        const assignee = users.find((u) => u.id === t.assigneeId);
        return (
          t.title.toLowerCase().includes(s) ||
          (assignee?.name || '').toLowerCase().includes(s) ||
          (t.sector && SECTOR_LABELS[t.sector as Sector]?.toLowerCase().includes(s))
        );
      });
    }
    return result;
  }, [createdTasks, filter, search, users]);

  // Stats
  const stats = useMemo(() => {
    const total = createdTasks.length;
    const done = createdTasks.filter((t) => t.status === 'done').length;
    const inProgress = createdTasks.filter((t) => t.status === 'in_progress').length;
    const todo = createdTasks.filter((t) => t.status === 'todo').length;
    const paused = createdTasks.filter((t) => t.status === 'paused').length;
    return {
      total,
      done,
      inProgress,
      todo,
      paused,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [createdTasks]);

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || id;

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Acompanhamento de Tarefas</h2>
        <p className="text-sm text-muted-foreground">
          Acompanhe o andamento das tarefas que você atribuiu
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.todo}</p>
            <p className="text-xs text-muted-foreground">A Fazer</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.paused}</p>
            <p className="text-xs text-muted-foreground">Em Pausa</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{stats.done}</p>
            <p className="text-xs text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso geral</span>
          <span className="font-medium">{stats.progress}%</span>
        </div>
        <Progress value={stats.progress} className="h-2" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, funcionário ou setor..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Concluídas'}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma tarefa encontrada</p>
          </div>
        )}

        {filteredTasks.map((task) => {
          const assignee = users.find((u) => u.id === task.assigneeId);
          const related = getRelatedItems(task);
          const isExpanded = expandedTasks.has(task.id);
          const hasRelated = related.length > 0;

          return (
            <Card key={task.id} className="border-border overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => (hasRelated ? toggleExpand(task.id) : setSelectedTask(task))}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {STATUS_ICONS[task.status] || <Circle className="w-4 h-4" />}
                </div>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-medium text-sm truncate cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                      }}
                    >
                      {task.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[task.status])}
                    >
                      {STATUS_LABELS[task.status]}
                    </Badge>
                    {task.sector && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {SECTOR_LABELS[task.sector as Sector]}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {assignee && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {assignee.name}
                      </span>
                    )}
                    {!assignee && task.sector && (
                      <span className="flex items-center gap-1 text-warning">
                        <Clock className="w-3 h-3" />
                        Aguardando resgate
                      </span>
                    )}
                    {task.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.deadline.split(' ')[0]}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </div>
                </div>

                {/* Expand indicator */}
                {hasRelated && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span className="text-[10px]">
                      {related.length} relacionada{related.length > 1 ? 's' : ''}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>

              {/* Related items */}
              {hasRelated && isExpanded && (
                <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Tarefas relacionadas
                  </p>
                  {related.map((rel, idx) => {
                    if (rel.type === 'task') {
                      const t = rel.item as Task;
                      const tAssignee = users.find((u) => u.id === t.assigneeId);
                      return (
                        <div
                          key={`task-${t.id}`}
                          className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border cursor-pointer hover:bg-accent/30 transition-colors"
                          onClick={() => setSelectedTask(t)}
                        >
                          <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{t.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {tAssignee ? tAssignee.name : 'Sem atribuição'}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[t.status])}
                          >
                            {STATUS_LABELS[t.status]}
                          </Badge>
                        </div>
                      );
                    } else {
                      const r = rel.item as MotoboyAssignment;
                      const motoboy = users.find((u) => u.id === r.assigned_to);
                      return (
                        <div
                          key={`ride-${r.id}`}
                          className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border"
                        >
                          <Bike className="w-4 h-4 text-warning flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {r.description}
                            </span>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              {motoboy && <span>{motoboy.name}</span>}
                              {r.assigned_to === 'pending' && (
                                <span className="text-warning">Aguardando designação</span>
                              )}
                              {r.client_name && <span>• {r.client_name}</span>}
                              {r.location && <span>• {r.location}</span>}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[r.status])}
                          >
                            {RIDE_STATUS_LABELS[r.status] || r.status}
                          </Badge>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </div>
  );
};

export default TaskTrackingPage;
