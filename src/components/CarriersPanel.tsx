import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Truck, DollarSign, Save, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { cn } from '@/lib/utils';

export interface Carrier {
  id: string;
  name: string;
  blocked: boolean;
  created_at: string;
}

interface FreightDestination {
  id: string;
  city_slug: string;
  city_name: string;
  carrier: string;
  price: string;
  deadline: string;
  notes: string;
  per_km_rate: number | null;
  sort_order: number;
}

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const toIso = (value: any) => {
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const CarriersPanel = () => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const [destinations, setDestinations] = useState<FreightDestination[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newCity, setNewCity] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    action: () => void | Promise<void>;
  } | null>(null);

  const fetchCarriers = useCallback(async () => {
    try {
      const q = query(collection(db, 'carriers'), orderBy('name', 'asc'));

      const snapshot = await getDocs(q);

      setCarriers(
        snapshot.docs.map((carrierDoc) => {
          const data = carrierDoc.data();

          return {
            id: carrierDoc.id,
            name: data.name || '',
            blocked: data.blocked === true,
            created_at: toIso(data.created_at),
          };
        })
      );
    } catch (error) {
      console.error('Erro ao carregar transportadoras:', error);
      toast.error('Erro ao carregar transportadoras');
    }
  }, []);

  const fetchDestinations = useCallback(async () => {
    try {
      const q = query(collection(db, 'freight_destinations'), orderBy('sort_order', 'asc'));

      const snapshot = await getDocs(q);

      const data: FreightDestination[] = snapshot.docs.map((destinationDoc) => {
        const d = destinationDoc.data();

        return {
          id: destinationDoc.id,
          city_slug: d.city_slug || '',
          city_name: d.city_name || '',
          carrier: d.carrier || '',
          price: d.price || '',
          deadline: d.deadline || '',
          notes: d.notes || '',
          per_km_rate: typeof d.per_km_rate === 'number' ? d.per_km_rate : null,
          sort_order: typeof d.sort_order === 'number' ? d.sort_order : 0,
        };
      });

      data.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }

        return a.city_name.localeCompare(b.city_name);
      });

      setDestinations(data);
    } catch (error) {
      console.error('Erro ao carregar destinos:', error);
      toast.error('Erro ao carregar destinos de frete');
    }
  }, []);

  useEffect(() => {
    const carriersQuery = query(collection(db, 'carriers'), orderBy('name', 'asc'));

    const destinationsQuery = query(
      collection(db, 'freight_destinations'),
      orderBy('sort_order', 'asc')
    );

    const unsubscribeCarriers = onSnapshot(
      carriersQuery,
      () => fetchCarriers(),
      (error) => console.error('Realtime carriers:', error)
    );

    const unsubscribeDestinations = onSnapshot(
      destinationsQuery,
      () => fetchDestinations(),
      (error) => console.error('Realtime freight destinations:', error)
    );

    return () => {
      unsubscribeCarriers();
      unsubscribeDestinations();
    };
  }, [fetchCarriers, fetchDestinations]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    setLoading(true);

    try {
      const duplicateQuery = query(collection(db, 'carriers'), where('name', '==', name));

      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        toast.error('Transportadora já cadastrada');
        return;
      }

      await addDoc(collection(db, 'carriers'), {
        name,
        blocked: false,
        created_at: Timestamp.now(),
      });

      setNewName('');
      toast.success('Transportadora cadastrada');
    } catch (error) {
      console.error('Erro ao cadastrar transportadora:', error);
      toast.error('Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  const toggleBlocked = async (c: Carrier) => {
    try {
      await updateDoc(doc(db, 'carriers', c.id), {
        blocked: !c.blocked,
      });

      toast.success(!c.blocked ? `${c.name} bloqueada` : `${c.name} desbloqueada`);
    } catch (error) {
      console.error('Erro ao atualizar transportadora:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const remove = async (c: Carrier) => {
    try {
      await deleteDoc(doc(db, 'carriers', c.id));
      toast.success('Transportadora excluída');
    } catch (error) {
      console.error('Erro ao excluir transportadora:', error);
      toast.error('Erro ao excluir');
    }
  };

  const updateDest = (id: string, patch: Partial<FreightDestination>) => {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const saveDest = async (d: FreightDestination) => {
    setSavingId(d.id);

    try {
      await updateDoc(doc(db, 'freight_destinations', d.id), {
        city_name: d.city_name,
        city_slug: slugify(d.city_name),
        carrier: d.carrier,
        price: d.price,
        deadline: d.deadline,
        notes: d.notes,
        per_km_rate: d.per_km_rate,
        updated_at: Timestamp.now(),
      });

      toast.success(`${d.city_name} atualizado`);
    } catch (error) {
      console.error('Erro ao salvar destino:', error);
      toast.error('Erro ao salvar');
    } finally {
      setSavingId(null);
    }
  };

  const removeDest = async (d: FreightDestination) => {
    try {
      await deleteDoc(doc(db, 'freight_destinations', d.id));
      toast.success('Destino removido');
    } catch (error) {
      console.error('Erro ao remover destino:', error);
      toast.error('Erro ao remover');
    }
  };

  const addDest = async () => {
    const name = newCity.trim();
    if (!name) return;

    const slug = slugify(name);

    if (destinations.some((d) => d.city_slug === slug)) {
      toast.error('Este destino já está cadastrado');
      return;
    }

    setAdding(true);

    try {
      const maxOrder = destinations.reduce((max, d) => Math.max(max, d.sort_order), 0);

      await addDoc(collection(db, 'freight_destinations'), {
        city_slug: slug,
        city_name: name,
        carrier: '',
        price: 'R$ 0,00',
        deadline: '',
        notes: '',
        per_km_rate: null,
        sort_order: maxOrder + 10,
        created_at: Timestamp.now(),
      });

      setNewCity('');
      toast.success('Destino adicionado');
    } catch (error) {
      console.error('Erro ao adicionar destino:', error);
      toast.error('Erro ao adicionar destino');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            Transportadoras
          </h3>

          <p className="text-xs text-muted-foreground">
            Cadastre as transportadoras disponíveis para os pedidos de separação. Transportadoras
            bloqueadas não aparecerão na seleção, mas o histórico é preservado.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da transportadora"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />

          <Button onClick={handleAdd} disabled={!newName.trim() || loading}>
            <Plus className="w-4 h-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {carriers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma transportadora cadastrada
          </p>
        ) : (
          <div className="space-y-2">
            {carriers.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'flex items-center justify-between bg-card border border-border rounded-xl p-3',
                  c.blocked && 'opacity-70 border-destructive/40'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Truck
                    className={cn(
                      'w-4 h-4 shrink-0',
                      c.blocked ? 'text-destructive' : 'text-primary'
                    )}
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>

                    <p className="text-[11px] text-muted-foreground">
                      {c.blocked ? 'Bloqueada' : 'Ativa'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.blocked ? 'Desbloquear' : 'Bloquear'}
                    </span>

                    <Switch checked={!c.blocked} onCheckedChange={() => toggleBlocked(c)} />
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      setConfirmAction({
                        title: 'Excluir transportadora',
                        description: `A transportadora "${c.name}" será removida definitivamente.`,
                        confirmLabel: 'Excluir',
                        destructive: true,
                        action: () => remove(c),
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Valores fixos de frete por destino
          </h3>

          <p className="text-xs text-muted-foreground">
            Cada linha representa uma cidade atendida. Ajuste o valor de cada destino de forma
            independente e adicione novos destinos quando necessário. Destinos com{' '}
            <span className="font-medium">Taxa por km</span> preenchida são calculados
            automaticamente pela distância.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="Nome da cidade (ex.: Aparecida)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addDest();
            }}
          />

          <Button onClick={addDest} disabled={!newCity.trim() || adding}>
            <Plus className="w-4 h-4 mr-1" />
            Adicionar destino
          </Button>
        </div>

        {destinations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum destino cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {destinations.map((d) => (
              <details
                key={d.id}
                className="bg-card border border-border rounded-xl overflow-hidden group"
              >
                <summary className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/30 list-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />

                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{d.city_name}</p>

                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.carrier || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {d.per_km_rate != null
                        ? `R$ ${Number(d.per_km_rate).toFixed(2).replace('.', ',')}/km`
                        : d.price || '—'}
                    </span>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        removeDest(d);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </summary>

                <div className="p-4 border-t border-border/50 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Cidade</label>

                      <Input
                        value={d.city_name}
                        onChange={(e) =>
                          updateDest(d.id, {
                            city_name: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Transportador</label>

                      <Input
                        value={d.carrier}
                        onChange={(e) =>
                          updateDest(d.id, {
                            carrier: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Valor (deixe vazio se usar taxa por km)
                      </label>

                      <Input
                        value={d.price}
                        onChange={(e) =>
                          updateDest(d.id, {
                            price: e.target.value,
                          })
                        }
                        placeholder="Ex.: R$ 60,00"
                        disabled={d.per_km_rate != null}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Taxa por km rodado (R$) — opcional
                      </label>

                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.per_km_rate ?? ''}
                        placeholder="Vazio = valor fixo acima"
                        onChange={(e) =>
                          updateDest(d.id, {
                            per_km_rate: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-muted-foreground">Prazo</label>

                      <Input
                        value={d.deadline}
                        onChange={(e) =>
                          updateDest(d.id, {
                            deadline: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-muted-foreground">Observações</label>

                      <Textarea
                        value={d.notes}
                        onChange={(e) =>
                          updateDest(d.id, {
                            notes: e.target.value,
                          })
                        }
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => saveDest(d)} disabled={savingId === d.id}>
                      <Save className="w-3.5 h-3.5 mr-1" />

                      {savingId === d.id ? 'Salvando…' : 'Salvar alterações'}
                    </Button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

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
};

export default CarriersPanel;
