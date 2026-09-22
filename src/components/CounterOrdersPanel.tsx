import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { ShoppingBag, ExternalLink, Trash2, Check, History, Clock } from 'lucide-react';
import { arrivalLabel } from '@/lib/counterOrderDeadline';

interface StatusEvent {
  status: string;
  at: string;
  by_id?: string | null;
  by_name?: string | null;
}
interface CounterOrder {
  id: string;
  item_name: string;
  code: string | null;
  application: string | null;
  quantity: number;
  brand: string | null;
  purchase_value: number | null;
  sold_value: number | null;
  deadline: string | null;
  supplier: string | null;
  link: string | null;
  client_id: string | null;
  status: string;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  ordered_at: string | null;
  status_history: StatusEvent[] | null;
}

const empty = {
  item_name: '',
  code: '',
  application: '',
  quantity: 1,
  brand: '',
  purchase_value: '' as string | number,
  sold_value: '' as string | number,
  deadline: '',
  supplier: '',
  link: '',
  client_id: '',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  ordered: 'Pedido',
  received: 'Recebido',
  completed: 'Concluído',
  canceled: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  ordered: 'bg-info/10 text-info border-info/20',
  received: 'bg-success/10 text-success border-success/20',
  completed: 'bg-success/10 text-success border-success/20',
  canceled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const fmtDT = (iso: string) => new Date(iso).toLocaleString('pt-BR');

export default function CounterOrdersPage() {
  const { currentUser } = useApp();
  const [orders, setOrders] = useState<CounterOrder[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    action: () => void | Promise<void>;
  } | null>(null);

  const load = async () => {
    // Mantido por compatibilidade; o listener abaixo já mantém a lista atualizada.
  };

  useEffect(() => {
    const ordersQuery = query(collection(db, 'counter_orders'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        setOrders(
          snapshot.docs.map((orderDoc) => {
            const data = orderDoc.data();
            const createdAt = data.created_at?.toDate
              ? data.created_at.toDate().toISOString()
              : data.created_at || '';
            const orderedAt = data.ordered_at?.toDate
              ? data.ordered_at.toDate().toISOString()
              : data.ordered_at || null;

            return {
              id: orderDoc.id,
              ...data,
              created_at: createdAt,
              ordered_at: orderedAt,
              status_history: Array.isArray(data.status_history) ? data.status_history : [],
            } as CounterOrder;
          })
        );
      },
      (error) => console.error('Erro ao carregar encomendas:', error)
    );

    return () => unsubscribe();
  }, []);

  const set = (k: keyof typeof empty, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.item_name.trim()) {
      toast.error('Informe o nome do item');
      return;
    }
    setLoading(true);
    const nowIso = new Date().toISOString();
    const payload = {
      item_name: form.item_name.trim(),
      code: form.code || null,
      application: form.application || null,
      quantity: Number(form.quantity) || 1,
      brand: form.brand || null,
      purchase_value: form.purchase_value === '' ? null : Number(form.purchase_value),
      sold_value: form.sold_value === '' ? null : Number(form.sold_value),
      deadline: form.deadline || null,
      supplier: form.supplier || null,
      link: form.link || null,
      client_id: form.client_id || null,
      created_by_id: currentUser?.id || null,
      created_by_name: currentUser?.name || null,
      status: 'pending',
      status_history: [
        {
          status: 'pending',
          at: nowIso,
          by_id: currentUser?.id || null,
          by_name: currentUser?.name || null,
        },
      ],
    };
    try {
      await addDoc(collection(db, 'counter_orders'), {
        ...payload,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
      toast.error('Erro ao criar encomenda');
      return;
    }
    setLoading(false);
    toast.success('Encomenda registrada');
    setForm({ ...empty });
  };

  const updateStatus = async (id: string, status: string) => {
    const cur = orders.find((o) => o.id === id);
    const history: StatusEvent[] = Array.isArray(cur?.status_history)
      ? [...cur!.status_history!]
      : [];
    const nowIso = new Date().toISOString();
    history.push({
      status,
      at: nowIso,
      by_id: currentUser?.id || null,
      by_name: currentUser?.name || null,
    });
    const patch: any = { status, status_history: history };
    if (status === 'ordered' && !cur?.ordered_at) patch.ordered_at = nowIso;
    try {
      await updateDoc(doc(db, 'counter_orders', id), {
        ...patch,
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar');
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'counter_orders', id));
      toast.success('Encomenda excluída');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir');
    }
  };

  const fmt = (n: number | null) =>
    n == null ? '-' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const openOrders = orders.filter((o) => o.status !== 'canceled' && o.status !== 'completed');
  const archivedOrders = orders.filter((o) => o.status === 'canceled' || o.status === 'completed');

  return (
    <div className="w-full min-w-0 space-y-5 md:space-y-6">
      <section className="jf-diagonal-accent overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Operação de balcão
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Encomendas Balcão
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhe encomendas abertas, prazos, fornecedores e histórico de status.
            </p>
          </div>
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="w-4 h-4 mr-1" /> Histórico de Encomendas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl rounded-2xl">
              <DialogHeader>
                <DialogTitle>Histórico de Encomendas</DialogTitle>
                <DialogDescription>
                  Consulte encomendas concluídas ou canceladas e suas mudanças de status.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[65vh] pr-3">
                {archivedOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Nenhuma encomenda no histórico ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {archivedOrders.map((o) => (
                      <div
                        key={o.id}
                        className="border border-border rounded p-3 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium">{o.item_name}</span>
                          <Badge variant="outline" className={STATUS_COLOR[o.status] || ''}>
                            {STATUS_LABEL[o.status] || o.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Solicitante: {o.created_by_name || '-'} • Qtd: {o.quantity}
                          {o.code ? ` • Cód: ${o.code}` : ''}
                          {o.brand ? ` • ${o.brand}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Solicitado em {fmtDT(o.created_at)}
                        </div>
                        {Array.isArray(o.status_history) && o.status_history.length > 0 && (
                          <div className="text-xs mt-2 space-y-0.5">
                            <div className="font-medium">Mudanças de status:</div>
                            {o.status_history.map((h, i) => (
                              <div key={i} className="text-muted-foreground">
                                • {STATUS_LABEL[h.status] || h.status} em {fmtDT(h.at)}
                                {h.by_name ? ` por ${h.by_name}` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* LISTAGEM (em cima para fácil visualização dos compradores) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Fila operacional
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Encomendas em aberto ({openOrders.length})
            </h2>
          </div>
        </div>
        {openOrders.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground shadow-card">
            Nenhuma encomenda em aberto.
          </Card>
        ) : (
          <div className="grid gap-3">
            {openOrders.map((o) => (
              <Card key={o.id} className="rounded-2xl border-border/70 p-4 shadow-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{o.item_name}</h3>
                      <Badge variant="outline" className={STATUS_COLOR[o.status] || ''}>
                        {STATUS_LABEL[o.status] || o.status}
                      </Badge>
                      {o.code && (
                        <span className="text-xs text-muted-foreground">Cód: {o.code}</span>
                      )}
                      {o.brand && (
                        <span className="text-xs text-muted-foreground">• {o.brand}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Qtd:</span> {o.quantity}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fornecedor:</span>{' '}
                        {o.supplier || '-'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Prazo:</span> {o.deadline || '-'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Aplicação:</span>{' '}
                        {o.application || '-'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">V. Compra:</span>{' '}
                        {fmt(o.purchase_value)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">V. Venda:</span> {fmt(o.sold_value)}
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Solicitante:</span>{' '}
                        {o.created_by_name || '-'}
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <span className="text-muted-foreground">Solicitado em:</span>{' '}
                        {fmtDT(o.created_at)}
                        {o.ordered_at && (
                          <>
                            {' '}
                            • <span className="text-muted-foreground">Pedido em:</span>{' '}
                            {fmtDT(o.ordered_at)}
                          </>
                        )}
                      </div>
                      {(() => {
                        const arr = arrivalLabel(o.ordered_at, o.deadline);
                        if (!arr && !o.deadline) return null;
                        return (
                          <div className="col-span-2 md:col-span-4 flex items-center gap-1 text-success">
                            <Clock className="w-3 h-3" />
                            <span className="text-muted-foreground">Previsão de chegada:</span>{' '}
                            {arr ? arr : 'aguardando pedido'}
                          </div>
                        );
                      })()}
                      {o.client_id && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">ID Cliente:</span> {o.client_id}
                        </div>
                      )}
                    </div>
                    {Array.isArray(o.status_history) && o.status_history.length > 1 && (
                      <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                        {o.status_history.map((h, i) => (
                          <div key={i}>
                            • {STATUS_LABEL[h.status] || h.status} em {fmtDT(h.at)}
                            {h.by_name ? ` por ${h.by_name}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {o.link && (
                      <a
                        href={o.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-info hover:underline mt-2"
                      >
                        <ExternalLink className="w-3 h-3" /> Link
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1">
                      {o.status !== 'received' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs flex-1"
                          onClick={() => updateStatus(o.id, 'received')}
                        >
                          <Check className="w-3 h-3 mr-1" /> Recebido
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() =>
                          setConfirmAction({
                            title: 'Excluir encomenda',
                            description: `A encomenda "${o.item_name}" será removida definitivamente.`,
                            confirmLabel: 'Excluir',
                            destructive: true,
                            action: () => remove(o.id),
                          })
                        }
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* FORMULÁRIO */}
      <Card className="rounded-2xl border-border/70 p-4 shadow-card md:p-6">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Novo registro
          </p>
          <h2 className="mt-1 text-lg font-semibold">Nova Encomenda</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Nome do Item *</Label>
            <Input value={form.item_name} onChange={(e) => set('item_name', e.target.value)} />
          </div>
          <div>
            <Label>Código</Label>
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} />
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Aplicação</Label>
            <Textarea
              rows={2}
              value={form.application}
              onChange={(e) => set('application', e.target.value)}
            />
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
            />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
          </div>
          <div>
            <Label>Valor de Compra (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.purchase_value}
              onChange={(e) => set('purchase_value', e.target.value)}
            />
          </div>
          <div>
            <Label>Valor Vendido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.sold_value}
              onChange={(e) => set('sold_value', e.target.value)}
            />
          </div>
          <div>
            <Label>Prazo</Label>
            <Input
              placeholder="Ex: 5 dias úteis ou 3 horas"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
            />
          </div>
          <div>
            <Label>Link</Label>
            <Input
              placeholder="https://..."
              value={form.link}
              onChange={(e) => set('link', e.target.value)}
            />
          </div>
          <div>
            <Label>ID Cliente</Label>
            <Input
              placeholder="Ex: CLI-00123"
              value={form.client_id}
              onChange={(e) => set('client_id', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Salvando...' : 'Registrar Encomenda'}
          </Button>
        </div>
      </Card>

      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.title || 'Confirmar ação'}
        description={confirmAction?.description || ''}
        confirmLabel={confirmAction?.confirmLabel}
        destructive={confirmAction?.destructive}
        onConfirm={async () => {
          if (!confirmAction) return;
          await confirmAction.action();
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
