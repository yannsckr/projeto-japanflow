import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Truck, DollarSign, Save, MapPin } from 'lucide-react';
import { toast } from 'sonner';
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

const CarriersPanel = () => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const [destinations, setDestinations] = useState<FreightDestination[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newCity, setNewCity] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchCarriers = useCallback(async () => {
    const { data, error } = await supabase
      .from('carriers' as any)
      .select('*')
      .order('name');
    if (error) {
      toast.error('Erro ao carregar transportadoras');
      return;
    }
    setCarriers((data as any) || []);
  }, []);

  const fetchDestinations = useCallback(async () => {
    const { data, error } = await supabase
      .from('freight_destinations' as any)
      .select('*')
      .order('sort_order')
      .order('city_name');
    if (error) {
      toast.error('Erro ao carregar destinos de frete');
      return;
    }
    setDestinations((data as any) || []);
  }, []);

  useEffect(() => {
    fetchCarriers();
    fetchDestinations();
    const ch = supabase
      .channel('carriers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carriers' }, () =>
        fetchCarriers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'freight_destinations' },
        () => fetchDestinations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchCarriers, fetchDestinations]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    const { error } = await supabase.from('carriers' as any).insert({ name });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes('duplicate') ? 'Transportadora já cadastrada' : 'Erro ao cadastrar'
      );
      return;
    }
    setNewName('');
    toast.success('Transportadora cadastrada');
  };

  const toggleBlocked = async (c: Carrier) => {
    const { error } = await supabase
      .from('carriers' as any)
      .update({ blocked: !c.blocked })
      .eq('id', c.id);
    if (error) return toast.error('Erro ao atualizar');
    toast.success(!c.blocked ? `${c.name} bloqueada` : `${c.name} desbloqueada`);
  };

  const remove = async (c: Carrier) => {
    if (!confirm(`Excluir a transportadora "${c.name}"?`)) return;
    const { error } = await supabase.from('carriers' as any).delete().eq('id', c.id);
    if (error) return toast.error('Erro ao excluir');
    toast.success('Transportadora excluída');
  };

  // ============ Destinations ============
  const updateDest = (id: string, patch: Partial<FreightDestination>) => {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const saveDest = async (d: FreightDestination) => {
    setSavingId(d.id);
    const { error } = await supabase
      .from('freight_destinations' as any)
      .update({
        city_name: d.city_name,
        carrier: d.carrier,
        price: d.price,
        deadline: d.deadline,
        notes: d.notes,
        per_km_rate: d.per_km_rate,
      })
      .eq('id', d.id);
    setSavingId(null);
    if (error) return toast.error('Erro ao salvar');
    toast.success(`${d.city_name} atualizado`);
  };

  const removeDest = async (d: FreightDestination) => {
    if (!confirm(`Remover o destino "${d.city_name}"?`)) return;
    const { error } = await supabase
      .from('freight_destinations' as any)
      .delete()
      .eq('id', d.id);
    if (error) return toast.error('Erro ao remover');
    toast.success('Destino removido');
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
    const maxOrder = destinations.reduce((m, d) => Math.max(m, d.sort_order), 0);
    const { error } = await supabase.from('freight_destinations' as any).insert({
      city_slug: slug,
      city_name: name,
      carrier: '',
      price: 'R$ 0,00',
      deadline: '',
      notes: '',
      per_km_rate: null,
      sort_order: maxOrder + 10,
    });
    setAdding(false);
    if (error) return toast.error('Erro ao adicionar destino');
    setNewCity('');
    toast.success('Destino adicionado');
  };

  return (
    <div className="space-y-8">
      {/* ============ Transportadoras cadastradas ============ */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" /> Transportadoras
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
            <Plus className="w-4 h-4 mr-1" /> Adicionar
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
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ Destinos de frete ============ */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Valores fixos de frete por destino
          </h3>
          <p className="text-xs text-muted-foreground">
            Cada linha representa uma cidade atendida. Ajuste o valor de cada destino de forma
            independente e adicione novos destinos quando necessário. Destinos com{' '}
            <span className="font-medium">Taxa por km</span> preenchida são calculados
            automaticamente pela distância (motoboy próprio).
          </p>
        </div>

        {/* Adicionar novo destino */}
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
            <Plus className="w-4 h-4 mr-1" /> Adicionar destino
          </Button>
        </div>

        {destinations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
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
                        onChange={(e) => updateDest(d.id, { city_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Transportador</label>
                      <Input
                        value={d.carrier}
                        onChange={(e) => updateDest(d.id, { carrier: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Valor (deixe vazio se usar taxa por km)
                      </label>
                      <Input
                        value={d.price}
                        onChange={(e) => updateDest(d.id, { price: e.target.value })}
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
                        onChange={(e) => updateDest(d.id, { deadline: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-muted-foreground">Observações</label>
                      <Textarea
                        value={d.notes}
                        onChange={(e) => updateDest(d.id, { notes: e.target.value })}
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
    </div>
  );
};

export default CarriersPanel;
