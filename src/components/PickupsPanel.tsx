import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
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
import { Package, History, CheckCircle2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_USER_IDS = ['emp-1', 'emp-2', 'emp-9', 'emp-1781181301491'];

export const canSeePickups = (
  user: {
    id: string;
    role: string;
    sectors?: string[];
  } | null
) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  if ((user.sectors || []).includes('administracao')) {
    return true;
  }

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

interface PickupFirestore {
  orderTitle?: string;
  deliveryType?: string;
  carrierName?: string | null;
  details?: string | null;
  createdBy?: string;
  status?: string;
  completedAt?: Timestamp | null;
  completedBy?: string | null;
  completedByName?: string | null;
  createdAt?: Timestamp;
}

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR');

const PickupsPanel = () => {
  const { currentUser, users } = useApp();

  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detail, setDetail] = useState<PickupRow | null>(null);

  useEffect(() => {
    if (!canSeePickups(currentUser)) {
      setPickups([]);
      return;
    }

    const pickupsQuery = query(collection(db, 'pickups'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      pickupsQuery,
      (snapshot) => {
        const nextPickups: PickupRow[] = snapshot.docs.map((pickupDoc) => {
          const data = pickupDoc.data() as PickupFirestore;

          return {
            id: pickupDoc.id,

            order_title: data.orderTitle || '',

            delivery_type: data.deliveryType || 'balcao',

            carrier_name: data.carrierName || null,

            details: data.details || null,

            created_by: data.createdBy || '',

            status: data.status || 'pending',

            completed_at: data.completedAt?.toDate ? data.completedAt.toDate().toISOString() : null,

            completed_by: data.completedBy || null,

            completed_by_name: data.completedByName || null,

            created_at: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString(),
          };
        });

        setPickups(nextPickups);
      },
      (error) => {
        console.error('Erro ao acompanhar retiradas:', error);
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

    setPickups((prev) =>
      prev.map((pickup) =>
        pickup.id === id
          ? {
              ...pickup,
              status: 'done',
              completed_at: completedAt.toDate().toISOString(),
              completed_by: currentUser.id,
              completed_by_name: currentUser.name,
            }
          : pickup
      )
    );

    try {
      await updateDoc(doc(db, 'pickups', id), {
        status: 'done',
        completedAt,
        completedBy: currentUser.id,
        completedByName: currentUser.name,
      });

      toast.success('Retirada concluída');
    } catch (error) {
      console.error('Erro ao concluir retirada:', error);

      toast.error('Erro ao concluir retirada');
    }
  };

  const handleRevert = async (id: string) => {
    try {
      await updateDoc(doc(db, 'pickups', id), {
        status: 'pending',
        completedAt: null,
        completedBy: null,
        completedByName: null,
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
    <div className="jf-surface space-y-3 overflow-hidden p-4">
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
        <p className="text-xs text-muted-foreground">Nenhuma retirada pendente.</p>
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
                  handleComplete(detail.id);
                  setDetail(null);
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
