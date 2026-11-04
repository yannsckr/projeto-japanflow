import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, Timestamp, updateDoc } from 'firebase/firestore';

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
import {
  canAccessPickups,
  normalizePickupStatus,
  toOperationalIso,
} from '@/lib/operationalTracking';

export const canSeePickups = canAccessPickups;

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

interface PickupFirestore {
  order_title?: string;
  orderTitle?: string;
  delivery_type?: string;
  deliveryType?: string;
  carrier_name?: string | null;
  carrierName?: string | null;
  details?: string | null;
  created_by?: string;
  createdBy?: string;
  status?: string;
  completed_at?: Timestamp | null;
  completedAt?: Timestamp | null;
  completed_by?: string | null;
  completedBy?: string | null;
  completed_by_name?: string | null;
  completedByName?: string | null;
  created_at?: Timestamp;
  createdAt?: Timestamp;
}

const formatDate = (iso: string) => {
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? 'Data não informada' : value.toLocaleString('pt-BR');
};

const PickupsPanel = () => {
  const { currentUser, users } = useApp();

  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detail, setDetail] = useState<PickupRow | null>(null);
  const [pickupError, setPickupError] = useState<string | null>(null);

  useEffect(() => {
    if (!canSeePickups(currentUser)) {
      setPickups([]);
      setPickupError(null);
      return;
    }

    const pickupsQuery = query(collection(db, 'pickups'));

    const unsubscribe = onSnapshot(
      pickupsQuery,
      (snapshot) => {
        const nextPickups: PickupRow[] = snapshot.docs.map((pickupDoc) => {
          const data = pickupDoc.data() as PickupFirestore;

          return {
            id: pickupDoc.id,

            order_title: data.order_title || data.orderTitle || '',

            delivery_type: data.delivery_type || data.deliveryType || 'balcao',

            carrier_name: data.carrier_name || data.carrierName || null,

            details: data.details || null,

            created_by: data.created_by || data.createdBy || '',

            status: normalizePickupStatus(data.status),

            completed_at: toOperationalIso(data.completed_at || data.completedAt) || null,

            completed_by: data.completed_by || data.completedBy || null,

            completed_by_name: data.completed_by_name || data.completedByName || null,

            created_at: toOperationalIso(data.created_at || data.createdAt),
          };
        });

        setPickups(nextPickups.sort((x, y) => y.created_at.localeCompare(x.created_at)));
        setPickupError(null);
      },
      (error) => {
        console.error('Erro ao acompanhar retiradas:', error);
        setPickupError(error.message);
        toast.error('Falha ao carregar retiradas. Verifique sua permissão de acesso.');
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  if (!canSeePickups(currentUser)) {
    return null;
  }

  const pending = pickups.filter((pickup) => pickup.status === 'pending');

  const completed = pickups.filter((pickup) => pickup.status === 'done');

  const handleComplete = async (id: string) => {
    if (!currentUser) return;

    const completedAt = Timestamp.now();

    try {
      await updateDoc(doc(db, 'pickups', id), {
        status: 'done',
        completed_at: completedAt,
        completed_by: currentUser.id,
        completed_by_name: currentUser.name,
      });

      toast.success('Retirada concluída');
      setDetail(null);
    } catch (error) {
      console.error('Erro ao concluir retirada:', error);

      toast.error('Erro ao concluir retirada');
    }
  };

  const handleRevert = async (id: string) => {
    try {
      await updateDoc(doc(db, 'pickups', id), {
        status: 'pending',
        completed_at: null,
        completed_by: null,
        completed_by_name: null,
      });

      toast.success('Retirada revertida para pendente');
    } catch (error) {
      console.error('Erro ao reverter retirada:', error);

      toast.error('Erro ao reverter retirada');
    }
  };

  const creatorName = (id: string) => users.find((user) => user.id === id)?.name || id;

  const typeLabel = (pickup: PickupRow) =>
    pickup.delivery_type === 'balcao'
      ? '🏪 Balcão'
      : `🚛 ${pickup.carrier_name || 'Transportadora'}`;

  return (
    <div className="jf-surface w-full min-w-0 space-y-2.5 overflow-hidden p-3.5 md:p-4">
      {pickupError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        >
          Não foi possível carregar o histórico de retiradas: {pickupError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="h-4 w-4" />
          </span>
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

          <DialogContent className="max-w-2xl rounded-2xl">
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
                  {completed.map((pickup) => (
                    <div
                      key={pickup.id}
                      className="space-y-1 rounded-xl border border-border/70 bg-muted/15 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium">{pickup.order_title}</span>

                        <Badge variant="outline" className="text-[10px]">
                          {typeLabel(pickup)}
                        </Badge>
                      </div>

                      {pickup.details && (
                        <p className="text-xs text-muted-foreground whitespace-pre-line">
                          {pickup.details}
                        </p>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Criado por <b>{creatorName(pickup.created_by)}</b> em{' '}
                        {formatDate(pickup.created_at)}
                      </div>

                      <div className="text-xs text-success flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Concluído por{' '}
                        <b>{pickup.completed_by_name || creatorName(pickup.completed_by || '')}</b>
                        {pickup.completed_at && ` em ${formatDate(pickup.completed_at)}`}
                      </div>

                      <div className="pt-1">
                        <Button size="sm" variant="outline" onClick={() => handleRevert(pickup.id)}>
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
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-5 text-center text-xs text-muted-foreground">
          Nenhuma retirada pendente.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pending.map((pickup) => (
            <div
              key={pickup.id}
              className="jf-interactive flex min-h-0 flex-col gap-2 rounded-xl border border-border/70 bg-muted/10 p-2.5 hover:bg-muted/25"
            >
              <button
                onClick={() => setDetail(pickup)}
                className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-muted/30"
              >
                <div className="text-xs font-medium truncate">{pickup.order_title}</div>

                <div className="text-[10px] text-muted-foreground truncate">
                  {typeLabel(pickup)}
                </div>
              </button>

              <Button
                size="sm"
                onClick={() => handleComplete(pickup.id)}
                className="h-8 rounded-lg px-2 text-[11px]"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Concluir
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
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
                  void handleComplete(detail.id);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Concluir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PickupsPanel;
