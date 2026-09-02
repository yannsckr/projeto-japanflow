import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, History, CheckCircle2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_USER_IDS = ['emp-1', 'emp-2', 'emp-9', 'emp-1781181301491'];

export const canSeePickups = (user: { id: string; role: string; sectors?: string[] } | null) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if ((user.sectors || []).includes('administracao')) return true;
  return ALLOWED_USER_IDS.includes(user.id);
};

interface PickupRow {
  id: string;
  order_title: string;
  delivery_type: string;
  carrier_name: string | null;
  details: string | null;
  created_by: string;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  created_at: string;
}

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR');

const PickupsPanel = () => {
  const { currentUser, users } = useApp();
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detail, setDetail] = useState<PickupRow | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('pickups' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setPickups((data as any) || []);
  }, []);

  useEffect(() => {
    if (!canSeePickups(currentUser)) return;
    load();
    const channel = supabase
      .channel('pickups-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickups' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, load]);

  if (!canSeePickups(currentUser)) return null;

  const pending = pickups.filter((p) => p.status === 'pending');
  const completed = pickups.filter((p) => p.status === 'done');

  const handleComplete = async (id: string) => {
    if (!currentUser) return;
    const completedAt = new Date().toISOString();
    // Optimistic update so the card disappears immediately
    setPickups((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'done',
              completed_at: completedAt,
              completed_by: currentUser.id,
              completed_by_name: currentUser.name,
            }
          : p
      )
    );
    const { error } = await supabase
      .from('pickups' as any)
      .update({
        status: 'done',
        completed_at: completedAt,
        completed_by: currentUser.id,
        completed_by_name: currentUser.name,
      } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao concluir retirada');
      load();
      return;
    }
    toast.success('Retirada concluída');
  };

  const handleRevert = async (id: string) => {
    const { error } = await supabase
      .from('pickups' as any)
      .update({
        status: 'pending',
        completed_at: null,
        completed_by: null,
        completed_by_name: null,
      } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao reverter retirada');
      return;
    }
    toast.success('Retirada revertida para pendente');
  };

  const creatorName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const typeLabel = (p: PickupRow) =>
    p.delivery_type === 'balcao' ? '🏪 Balcão' : `🚛 ${p.carrier_name || 'Transportadora'}`;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Retiradas
          {pending.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {pending.length}
            </Badge>
          )}
        </h3>
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <History className="w-4 h-4 mr-1" />
              Histórico Retiradas
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Histórico de Retiradas</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-3">
              {completed.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Nenhuma retirada concluída ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {completed.map((p) => (
                    <div key={p.id} className="border border-border rounded p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium">{p.order_title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {typeLabel(p)}
                        </Badge>
                      </div>
                      {p.details && (
                        <p className="text-xs text-muted-foreground whitespace-pre-line">
                          {p.details}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Criado por <b>{creatorName(p.created_by)}</b> em {formatDate(p.created_at)}
                      </div>
                      <div className="text-xs text-success flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Concluído por{' '}
                        <b>{p.completed_by_name || creatorName(p.completed_by || '')}</b>
                        {p.completed_at && ` em ${formatDate(p.completed_at)}`}
                      </div>
                      <div className="pt-1">
                        <Button size="sm" variant="outline" onClick={() => handleRevert(p.id)}>
                          <Undo2 className="w-3 h-3 mr-1" />
                          Reverter
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma retirada pendente.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className="border border-border rounded p-1.5 flex flex-col gap-1 min-h-0"
            >
              <button
                onClick={() => setDetail(p)}
                className="text-left flex-1 min-w-0 hover:bg-muted/40 rounded transition px-1 py-0.5"
              >
                <div className="text-xs font-medium truncate">{p.order_title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{typeLabel(p)}</div>
              </button>
              <Button
                size="sm"
                onClick={() => handleComplete(p.id)}
                className="h-6 text-[11px] px-2"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Concluir
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detail?.order_title}
              {detail && (
                <Badge variant="outline" className="text-[10px]">
                  {typeLabel(detail)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="text-xs space-y-1">
              {detail.details && (
                <p className="whitespace-pre-line text-muted-foreground">{detail.details}</p>
              )}
              <div className="text-muted-foreground">
                Criado por <b>{creatorName(detail.created_by)}</b> em{' '}
                {formatDate(detail.created_at)}
              </div>
              <Button
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  handleComplete(detail.id);
                  setDetail(null);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PickupsPanel;
