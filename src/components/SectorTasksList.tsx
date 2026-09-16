import { HandMetal } from 'lucide-react';
import { toast } from 'sonner';

import { useApp } from '@/contexts/AppContext';
import { SECTOR_LABELS, Sector } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SectorTasksListProps {
  userId: string;
}

const PRIORITY_STYLES = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-muted text-muted-foreground border-border',
};

const SectorTasksList = ({ userId }: SectorTasksListProps) => {
  const { users, tasks, claimSectorTask } = useApp();
  const user = users.find((item) => item.id === userId);

  if (!user || !user.sectors || user.sectors.length === 0) return null;

  const sectorTasks = tasks.filter(
    (task) => task.sector && user.sectors.includes(task.sector as Sector) && !task.assigneeId
  );

  if (sectorTasks.length === 0) return null;

  const handleClaim = (taskId: string) => {
    claimSectorTask(taskId);
    toast.success('Tarefa resgatada para o seu quadro!');
  };

  return (
    <section className="jf-surface overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HandMetal className="h-4 w-4" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Tarefas do setor</h3>
            <p className="text-[11px] text-muted-foreground">
              {sectorTasks.length} disponíve{sectorTasks.length === 1 ? 'l' : 'is'} para resgate
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {sectorTasks.map((task) => (
          <div
            key={task.id}
            className="jf-interactive flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/15 p-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{task.title}</p>

                {task.sector && (
                  <Badge variant="outline" className="rounded-lg text-[10px]">
                    {SECTOR_LABELS[task.sector as Sector]}
                  </Badge>
                )}

                <Badge
                  variant="outline"
                  className={`rounded-lg text-[10px] ${PRIORITY_STYLES[task.priority]}`}
                >
                  {task.priority === 'high'
                    ? 'Alta'
                    : task.priority === 'medium'
                      ? 'Média'
                      : 'Baixa'}
                </Badge>
              </div>

              {task.description && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{task.description}</p>
              )}
            </div>

            <Button
              size="sm"
              onClick={() => handleClaim(task.id)}
              className="h-9 shrink-0 rounded-xl"
            >
              Resgatar
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SectorTasksList;
