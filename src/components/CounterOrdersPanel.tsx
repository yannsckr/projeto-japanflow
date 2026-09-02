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
import { ShoppingBag, CheckCircle2, Clock, History } from 'lucide-react';
import { toast } from 'sonner';
import { computeArrival, parsePrazo, fmtArrival } from '@/lib/counterOrderDeadline';

const MOISES_ID = 'emp-10';

export const canSeeCounterOrdersPanel = (user: { id: string; sectors?: string[] } | null) => {
  if (!user) return false;
  if (user.id === MOISES_ID) return true;
  return (user.sectors || []).includes('vendas');
};

interface Row {
  id: string;
  item_name: string;
  code: string | null;
  brand: string | null;
  quantity: number;
  supplier: string | null;
  deadline: string | null;
  application: string | null;
  client_id: string | null;
  link: string | null;
  purchase_value: number | null;
  sold_value: number | null;
  status: string;
  ordered_at: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  status_history: any[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  ordered: 'Pedido',
  received: 'Recebido',
  completed: 'Concluído',
  canceled: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
  ordered: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  received: 'bg-green-500/20 text-green-200 border-green-500/40',
  completed: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  canceled: 'bg-red-500/20 text-red-200 border-red-500/40',
};

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR');
const fmtBR = (n: number | null) =>
  n == null ? '-' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const computeDeadline = (orderedAt: string | null, deadline: string | null) =>
  computeArrival(orderedAt, deadline);

const fmtDateOnly = (d: Date, withTime = false) => fmtArrival(d, withTime);

const CounterOrdersPanel = () => {
  const { currentUser } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('counter_orders' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setRows((data as any) || []);
  }, []);

  useEffect(() => {
    if (!canSeeCounterOrdersPanel(currentUser)) return;
    load();
    const ch = supabase
      .channel('counter_orders_panel_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counter_orders' }, () =>
        load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentUser, load]);

  if (!canSeeCounterOrdersPanel(currentUser)) return null;

  const isMoises = currentUser?.id === MOISES_ID;

  const scopeForUser = (r: Row) => (isMoises ? true : r.created_by_id === currentUser?.id);

  const visible = rows.filter(
    (r) =>
      scopeForUser(r) &&
      r.status !== 'canceled' &&
      r.status !== 'completed' &&
      r.status !== 'received'
  );
  const archived = rows.filter(
    (r) =>
      scopeForUser(r) &&
      (r.status === 'canceled' || r.status === 'completed' || r.status === 'received')
  );

  const markReceived = async (o: Row) => {
    if (!currentUser) return;
    const history = Array.isArray(o.status_history) ? [...o.status_history] : [];
    history.push({
      status: 'received',
      at: new Date().toISOString(),
      by_id: currentUser.id,
      by_name: currentUser.name,
    });
    // Optimistic local update so the card disappears immediately
    setRows((prev) =>
      prev.map((r) => (r.id === o.id ? { ...r, status: 'received', status_history: history } : r))
    );
    const { error } = await supabase
      .from('counter_orders' as any)
      .update({ status: 'received', status_history: history } as any)
      .eq('id', o.id);
    if (error) {
      toast.error('Erro ao marcar recebido');
      load();
      return;
    }

    // Create a task to the requester so they can inform the buyer
    if (o.created_by_id) {
      const lines = [
        '✅ A encomenda solicitada chegou no estoque. Informe o comprador.',
        '',
        `• Item: ${o.item_name}`,
        o.code ? `• Código: ${o.code}` : null,
        o.brand ? `• Marca: ${o.brand}` : null,
        `• Quantidade: ${o.quantity}`,
        o.supplier ? `• Fornecedor: ${o.supplier}` : null,
        o.application ? `• Aplicação: ${o.application}` : null,
        o.client_id ? `• Cliente: ${o.client_id}` : null,
        o.purchase_value != null ? `• Valor de Compra: ${fmtBR(o.purchase_value)}` : null,
        o.sold_value != null ? `• Valor Vendido: ${fmtBR(o.sold_value)}` : null,
        o.deadline ? `• Prazo informado: ${o.deadline}` : null,
        o.link ? `• Link: ${o.link}` : null,
        `• Solicitado em: ${fmt(o.created_at)}`,
        o.ordered_at ? `• Pedido em: ${fmt(o.ordered_at)}` : null,
        '',
        'Ao concluir esta tarefa, a encomenda será automaticamente movida para o histórico.',
      ]
        .filter(Boolean)
        .join('\n');

      const now = new Date().toISOString();
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 1);
      const { error: tErr } = await supabase.from('tasks').insert({
        title: `📦 Encomenda chegou: ${o.item_name}`,
        description: lines,
        status: 'todo',
        priority: 'medium',
        assignee_id: o.created_by_id,
        created_by: currentUser.id,
        deadline: deadlineDate.toISOString(),
        status_history: [{ status: 'todo', enteredAt: now }] as any,
        linked_counter_order_id: o.id,
      } as any);
      if (tErr) {
        console.error('Erro criando tarefa de encomenda:', tErr);
        toast.error('Encomenda recebida, mas falhou ao criar tarefa para o solicitante');
      }
    }

    toast.success('Encomenda marcada como recebida');
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          Encomendas Balcão
          {visible.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {visible.length}
            </Badge>
          )}
        </h3>
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <History className="w-3 h-3 mr-1" /> Histórico de Encomendas
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Histórico de Encomendas</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-3">
              {archived.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Nenhuma encomenda no histórico ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {archived.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setDetail(o)}
                      className="w-full text-left border border-border rounded p-2 hover:bg-muted/40 transition"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-sm">{o.item_name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLOR[o.status] || ''}`}
                        >
                          {STATUS_LABEL[o.status] || o.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Solicitante: {o.created_by_name || '-'} • Solicitado em {fmt(o.created_at)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma encomenda em aberto.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {visible.map((o) => {
            const due = computeDeadline(o.ordered_at, o.deadline);
            const parsed = parsePrazo(o.deadline);
            const withTime = !!parsed && 'hours' in parsed;
            return (
              <button
                key={o.id}
                onClick={() => setDetail(o)}
                className="border border-border rounded p-2 text-left hover:bg-muted/40 transition flex flex-col gap-0.5 min-h-0"
              >
                <span className="text-xs font-medium truncate">{o.item_name}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                  <Clock className="w-3 h-3 shrink-0" />
                  {due
                    ? `Chega em ${fmtDateOnly(due, withTime)}`
                    : o.deadline
                      ? `Prazo: ${o.deadline} (aguardando pedido)`
                      : 'Aguardando pedido'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detail?.item_name}
              {detail && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${STATUS_COLOR[detail.status] || ''}`}
                >
                  {STATUS_LABEL[detail.status] || detail.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="text-xs space-y-1">
              {detail.code && (
                <div>
                  <span className="text-muted-foreground">Código:</span> {detail.code}
                </div>
              )}
              {detail.brand && (
                <div>
                  <span className="text-muted-foreground">Marca:</span> {detail.brand}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Quantidade:</span> {detail.quantity}
              </div>
              {detail.supplier && (
                <div>
                  <span className="text-muted-foreground">Fornecedor:</span> {detail.supplier}
                </div>
              )}
              {detail.application && (
                <div>
                  <span className="text-muted-foreground">Aplicação:</span> {detail.application}
                </div>
              )}
              {detail.client_id && (
                <div>
                  <span className="text-muted-foreground">Cliente:</span> {detail.client_id}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">V. Compra:</span>{' '}
                {fmtBR(detail.purchase_value)}
              </div>
              <div>
                <span className="text-muted-foreground">V. Venda:</span> {fmtBR(detail.sold_value)}
              </div>
              <div>
                <span className="text-muted-foreground">Prazo informado:</span>{' '}
                {detail.deadline || '-'}
              </div>
              <div>
                <span className="text-muted-foreground">Solicitante:</span>{' '}
                {detail.created_by_name || '-'}
              </div>
              <div>
                <span className="text-muted-foreground">Solicitado em:</span>{' '}
                {fmt(detail.created_at)}
              </div>
              {detail.ordered_at && (
                <div>
                  <span className="text-muted-foreground">Pedido em:</span> {fmt(detail.ordered_at)}
                </div>
              )}
              {(() => {
                const due = computeDeadline(detail.ordered_at, detail.deadline);
                const parsed = parsePrazo(detail.deadline);
                const withTime = !!parsed && 'hours' in parsed;
                return (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="text-muted-foreground">Previsão de chegada:</span>
                    {due ? ` ${fmtDateOnly(due, withTime)}` : ' Aguardando pedido'}
                  </div>
                );
              })()}
              {detail.link && (
                <a
                  href={detail.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline block break-all"
                >
                  {detail.link}
                </a>
              )}
              {Array.isArray(detail.status_history) && detail.status_history.length > 0 && (
                <div className="pt-2 border-t border-border mt-2">
                  <div className="font-medium mb-1">Histórico de status:</div>
                  {detail.status_history.map((h: any, i: number) => (
                    <div key={i} className="text-muted-foreground">
                      • {STATUS_LABEL[h.status] || h.status} em {fmt(h.at)}
                      {h.by_name ? ` por ${h.by_name}` : ''}
                    </div>
                  ))}
                </div>
              )}
              {isMoises &&
                detail.status !== 'received' &&
                detail.status !== 'completed' &&
                detail.status !== 'canceled' && (
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => {
                      markReceived(detail);
                      setDetail(null);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como Recebida
                  </Button>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CounterOrdersPanel;
