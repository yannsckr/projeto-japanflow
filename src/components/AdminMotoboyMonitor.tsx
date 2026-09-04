import { useState, useEffect } from 'react';
import { useDepartmental, MotoboyAssignment } from '@/hooks/useDepartmental';
import { useApp } from '@/contexts/AppContext';
import { Bike, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatElapsed = (from: string) => {
  const ms = Date.now() - new Date(from).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}min`;
  return `${mins}min`;
};

const AdminMotoboyMonitor = () => {
  const { motoboyAssignments } = useDepartmental();
  const { users } = useApp();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const active = motoboyAssignments.filter((a) => a.status !== 'completed');
  const completed = motoboyAssignments.filter((a) => a.status === 'completed').slice(0, 5);

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const isStale = (a: MotoboyAssignment) => {
    const ref = a.acceptedAt || a.createdAt;
    return a.status !== 'completed' && Date.now() - new Date(ref).getTime() > 20 * 60000;
  };

  if (motoboyAssignments.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Bike className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Monitor de Motoboys</h3>
        <span className="text-xs text-muted-foreground ml-auto">{active.length} ativa(s)</span>
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhuma entrega ativa</p>
      ) : (
        <div className="space-y-2 mb-4">
          {active.map((a) => (
            <div
              key={a.id}
              className={cn(
                'border rounded-lg p-3 text-sm',
                isStale(a) ? 'border-destructive/40 bg-destructive/5' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Motoboy: {getUserName(a.assignedTo)} • Atribuído por:{' '}
                    {getUserName(a.assignedBy)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {isStale(a) && (
                    <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
                  )}
                  <div className="text-right">
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                        'bg-primary/10 text-primary'
                      )}
                    >
                      {a.status === 'accepted' ? 'Em andamento' : a.status}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {formatElapsed(a.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
              {a.acceptedAt && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Aceita às{' '}
                  {new Date(a.acceptedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  • Em execução há {formatElapsed(a.acceptedAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Últimas concluídas
          </p>
          <div className="space-y-1.5">
            {completed.map((a) => (
              <div
                key={a.id}
                className="border border-border rounded-lg p-2 text-xs text-muted-foreground flex justify-between"
              >
                <span className="truncate">
                  {a.description} — {getUserName(a.assignedTo)}
                </span>
                {a.completedAt && (
                  <span className="text-[10px] shrink-0 ml-2">
                    {new Date(a.completedAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMotoboyMonitor;
