import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

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

export const canSeeCounterOrdersPanel = (
  user: {
    id: string;
    sectors?: string[];
  } | null
) => {
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

const toIso = (value: any): string | null => {
  if (!value) return null;
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
};

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

const fmtBR = (n: number | null) =>
  n == null
    ? '-'
    : n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

const computeDeadline = (orderedAt: string | null, deadline: string | null) =>
  computeArrival(orderedAt, deadline);

const fmtDateOnly = (d: Date, withTime = false) => fmtArrival(d, withTime);

const CounterOrdersPanel = () => {
  const { currentUser } = useApp();

  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!canSeeCounterOrdersPanel(currentUser)) {
      setRows([]);
      return;
    }

    const ordersQuery = query(collection(db, 'counter_orders'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const nextRows: Row[] = snapshot.docs.map((orderDoc) => {
          const d = orderDoc.data();

          return {
            id: orderDoc.id,
            item_name: d.item_name || '',
            code: d.code || null,
            brand: d.brand || null,
            quantity: Number(d.quantity || 0),
            supplier: d.supplier || null,
            deadline: d.deadline || null,
            application: d.application || null,
            client_id: d.client_id || null,
            link: d.link || null,

            purchase_value: typeof d.purchase_value === 'number' ? d.purchase_value : null,

            sold_value: typeof d.sold_value === 'number' ? d.sold_value : null,

            status: d.status || 'pending',

            ordered_at: toIso(d.ordered_at),

            created_by_id: d.created_by_id || null,

            created_by_name: d.created_by_name || null,

            created_at: toIso(d.created_at) || new Date().toISOString(),

            status_history: Array.isArray(d.status_history) ? d.status_history : [],
          };
        });

        setRows(nextRows);
      },
      (error) => {
        console.error('Erro ao acompanhar encomendas:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  if (!canSeeCounterOrdersPanel(currentUser)) {
    return null;
  }

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

    const nowIso = new Date().toISOString();

    history.push({
      status: 'received',
      at: nowIso,
      by_id: currentUser.id,
      by_name: currentUser.name,
    });

    setRows((prev) =>
      prev.map((r) =>
        r.id === o.id
          ? {
              ...r,
              status: 'received',
              status_history: history,
            }
          : r
      )
    );

    try {
      await updateDoc(doc(db, 'counter_orders', o.id), {
        status: 'received',
        status_history: history,
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erro ao marcar recebido:', error);

      toast.error('Erro ao marcar recebido');
      return;
    }

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

      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 1);

      try {
        await addDoc(collection(db, 'tasks'), {
          title: `📦 Encomenda chegou: ${o.item_name}`,
          description: lines,
          status: 'todo',
          priority: 'medium',
          assignee_id: o.created_by_id,
          created_by: currentUser.id,

          deadline: Timestamp.fromDate(deadlineDate),

          status_history: [
            {
              status: 'todo',
              enteredAt: nowIso,
            },
          ],

          linked_counter_order_id: o.id,

          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
      } catch (error) {
        console.error('Erro criando tarefa de encomenda:', error);

        toast.error('Encomenda recebida, mas falhou ao criar tarefa para o solicitante');
      }
    }

    toast.success('Encomenda marcada como recebida');
  };

  return (
    <div className="jf-surface space-y-3 overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="h-4 w-4" />
          </span>
          Encomendas Balcão
          {visible.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {visible.length}
            </Badge>
          )}
        </h3>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs">
              <History className="w-3 h-3 mr-1" />
              Histórico de Encomendas
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl rounded-2xl">
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
                      className="jf-interactive w-full rounded-xl border border-border/70 bg-muted/10 p-3 text-left hover:bg-muted/30"
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((o) => {
            const due = computeDeadline(o.ordered_at, o.deadline);

            const parsed = parsePrazo(o.deadline);

            const withTime = !!parsed && 'hours' in parsed;

            return (
              <button
                key={o.id}
                onClick={() => setDetail(o)}
                className="jf-interactive flex min-h-0 flex-col gap-1 rounded-xl border border-border/70 bg-muted/10 p-3 text-left hover:bg-muted/30"
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
        <DialogContent className="max-w-lg rounded-2xl">
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
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Marcar como Recebida
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
