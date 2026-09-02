import { useApp } from '@/contexts/AppContext';
import { SECTOR_LABELS, Sector } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HandMetal } from 'lucide-react';
import { toast } from 'sonner';

interface SectorTasksListProps {
  userId: string;
}

const PRIORITY_STYLES = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const SectorTasksList = ({ userId }: SectorTasksListProps) => {
  const { users, tasks, claimSectorTask } = useApp();
  const user = users.find((u) => u.id === userId);

  if (!user || !user.sectors || user.sectors.length === 0) return null;

  // Get unclaimed tasks for the user's sectors
  const sectorTasks = tasks.filter(
    (t) => t.sector && user.sectors.includes(t.sector as Sector) && !t.assigneeId
  );

  if (sectorTasks.length === 0) return null;

  const handleClaim = (taskId: string) => {
    claimSectorTask(taskId);
    toast.success('Tarefa resgatada para o seu quadro!');
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <HandMetal className="w-5 h-5 text-primary" />
        Tarefas do Setor
      </h3>
      <div className="grid gap-2">
        {sectorTasks.map((task) => (
          <div
            key={task.id}
            className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate">{task.title}</p>
                {task.sector && (
                  <Badge variant="outline" className="text-[10px]">
                    {SECTOR_LABELS[task.sector as Sector]}
                  </Badge>
                )}
                <Badge className={`text-[10px] ${PRIORITY_STYLES[task.priority]}`}>
                  {task.priority === 'high'
                    ? 'Alta'
                    : task.priority === 'medium'
                      ? 'Média'
                      : 'Baixa'}
                </Badge>
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{task.description}</p>
              )}
            </div>
            <Button size="sm" onClick={() => handleClaim(task.id)} className="shrink-0">
              Resgatar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectorTasksList;
