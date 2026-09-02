import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Play, FileText, CheckCircle2, Trash2, X, Camera, Loader2 } from 'lucide-react';
import { Sector } from '@/types';

const MOISES_ID = 'emp-10';

interface InventoryItem {
  code: string;
  type: string;
  quantity: string;
}
interface InventoryLocation {
  location_code: string;
  items: InventoryItem[];
}
interface Inventory {
  id: string;
  shelf_code: string;
  status: 'in_progress' | 'completed';
  started_by_id: string;
  started_by_name: string;
  locations: InventoryLocation[];
  started_at: string;
  finished_at: string | null;
}

const emptyItem = (): InventoryItem => ({ code: '', type: '', quantity: '' });

const InventoryPage = () => {
  const { currentUser } = useApp();
  const [shelfCode, setShelfCode] = useState('');
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [activeInventory, setActiveInventory] = useState<Inventory | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [detailInv, setDetailInv] = useState<Inventory | null>(null);

  // Active-session local editing state
  const [locationCode, setLocationCode] = useState('');
  const [items, setItems] = useState<InventoryItem[]>(() => Array.from({ length: 5 }, emptyItem));
  const [scanningIdx, setScanningIdx] = useState<number | null>(null);

  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] ?? '';
        resolve({ base64, mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleScan = async (idx: number, file: File | null) => {
    if (!file) return;
    setScanningIdx(idx);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('parse-inventory-label', {
        body: { imageBase64: base64, mimeType },
      });
      if (error) throw error;
      const type = (data?.type || '').toString();
      const code = (data?.code || '').toString();
      if (!type && !code) {
        toast.error('Não foi possível ler a etiqueta. Tente novamente.');
      } else {
        setItems((prev) =>
          prev.map((it, i) =>
            i === idx ? { ...it, type: type || it.type, code: code || it.code } : it
          )
        );
        toast.success('Etiqueta lida com sucesso');
      }
    } catch (e: any) {
      toast.error('Erro ao ler etiqueta: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setScanningIdx(null);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isMoises = currentUser?.id === MOISES_ID;
  const isEstoque = currentUser?.sectors?.includes('estoque' as Sector);
  const canReports = isAdmin || isMoises;

  const load = async () => {
    const { data } = await supabase
      .from('inventories')
      .select('*')
      .order('started_at', { ascending: false });
    if (data) setInventories(data as any);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('inventories-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventories' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const handleStart = async () => {
    if (!shelfCode.trim() || !currentUser) return;
    const shelf = shelfCode.trim().toUpperCase();

    const { data: inv, error } = await supabase
      .from('inventories')
      .insert({
        shelf_code: shelf,
        status: 'in_progress',
        started_by_id: currentUser.id,
        started_by_name: currentUser.name,
        locations: [],
      })
      .select()
      .single();
    if (error || !inv) {
      toast.error('Erro ao iniciar inventário');
      return;
    }

    // Broadcast popup to all users
    const { data: popup } = await supabase
      .from('admin_popups')
      .insert({
        title: `📦 Inventário em andamento - Prateleira ${shelf}`,
        content: `A prateleira ${shelf} está em processo de inventário.\n\nSe precisar de algum item dela, entre em contato com o Estoque antes de retirar.\n\nIniciado por ${currentUser.name}.`,
        created_by: currentUser.id,
        target_mode: 'all',
        target_sectors: [],
        target_users: [],
        attachments: [],
      })
      .select()
      .single();
    if (popup) {
      await supabase.from('inventories').update({ popup_id: popup.id }).eq('id', inv.id);
    }

    setShelfCode('');
    setActiveInventory(inv as any);
    setLocationCode('');
    setItems(Array.from({ length: 5 }, emptyItem));
    toast.success('Inventário iniciado e equipe notificada');
  };

  const addItemFields = () => {
    setItems((prev) => [...prev, ...Array.from({ length: 3 }, emptyItem)]);
  };

  const updateItem = (idx: number, field: keyof InventoryItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const saveCurrentLocation = async (): Promise<Inventory | null> => {
    if (!activeInventory) return null;
    if (!locationCode.trim()) {
      toast.error('Informe o código de localização');
      return null;
    }
    const cleanItems = items
      .map((i) => ({ code: i.code.trim(), type: i.type.trim(), quantity: i.quantity.trim() }))
      .filter((i) => i.code || i.type || i.quantity);
    if (cleanItems.length === 0) {
      toast.error('Adicione ao menos um item');
      return null;
    }
    const newLocations = [
      ...(activeInventory.locations || []),
      { location_code: locationCode.trim().toUpperCase(), items: cleanItems },
    ];
    const { data, error } = await supabase
      .from('inventories')
      .update({ locations: newLocations as any })
      .eq('id', activeInventory.id)
      .select()
      .single();
    if (error || !data) {
      toast.error('Erro ao salvar localização');
      return null;
    }
    const updated = data as any as Inventory;
    setActiveInventory(updated);
    return updated;
  };

  const handleAddAnotherLocation = async () => {
    const updated = await saveCurrentLocation();
    if (!updated) return;
    setLocationCode('');
    setItems(Array.from({ length: 5 }, emptyItem));
    toast.success('Localização adicionada. Continue com a próxima.');
  };

  const buildReportText = (inv: Inventory) => {
    const sections = inv.locations
      .map((loc) => {
        const itemsText = loc.items
          .map((it) => `  • Código ${it.code} — ${it.type} — Qtd: ${it.quantity}`)
          .join('\n');
        return `Localização: ${loc.location_code}\n${itemsText}`;
      })
      .join('\n\n');
    return `Relatório de Inventário — Prateleira ${inv.shelf_code}\nRealizado por: ${inv.started_by_name}\n\n${sections}`;
  };

  const handleFinalize = async () => {
    if (!activeInventory || !currentUser) return;
    // Save the in-progress location (if user filled it), but don't force them
    let finalInv: Inventory = activeInventory;
    const hasPending = locationCode.trim() || items.some((i) => i.code || i.type || i.quantity);
    if (hasPending) {
      const updated = await saveCurrentLocation();
      if (!updated) return;
      finalInv = updated;
    }
    if (!finalInv.locations || finalInv.locations.length === 0) {
      toast.error('Adicione ao menos uma localização antes de finalizar');
      return;
    }

    const reportText = buildReportText(finalInv);

    // Generate task for Moisés
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        title: `📋 Baixa de Inventário - Prateleira ${finalInv.shelf_code}`,
        description: `Realizar a baixa no sistema referente ao inventário da prateleira ${finalInv.shelf_code}.\n\n${reportText}`,
        status: 'todo',
        priority: 'medium',
        assignee_id: MOISES_ID,
        created_by: currentUser.id,
        deadline: '',
      })
      .select()
      .single();

    await supabase
      .from('inventories')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        task_id: task?.id ?? null,
      })
      .eq('id', finalInv.id);

    // Notify Moisés
    await supabase.from('notifications').insert({
      user_id: MOISES_ID,
      message: `Nova baixa de inventário disponível — Prateleira ${finalInv.shelf_code}`,
      type: 'task_created',
    });

    // Clean up: delete the broadcast popup so it stops showing
    if ((finalInv as any).popup_id) {
      await supabase
        .from('admin_popups')
        .delete()
        .eq('id', (finalInv as any).popup_id);
    }

    toast.success('Inventário finalizado e tarefa enviada a Moisés');
    setActiveInventory(null);
    setLocationCode('');
    setItems(Array.from({ length: 5 }, emptyItem));
  };

  const handleCancel = async () => {
    if (!activeInventory) return;
    if (!confirm('Cancelar este inventário? Os dados informados serão descartados.')) return;
    if ((activeInventory as any).popup_id) {
      await supabase
        .from('admin_popups')
        .delete()
        .eq('id', (activeInventory as any).popup_id);
    }
    await supabase.from('inventories').delete().eq('id', activeInventory.id);
    setActiveInventory(null);
    setLocationCode('');
    setItems(Array.from({ length: 5 }, emptyItem));
    toast.success('Inventário cancelado');
  };

  const inProgress = inventories.filter((i) => i.status === 'in_progress');
  const completed = inventories.filter((i) => i.status === 'completed');

  if (!isAdmin && !isEstoque && !isMoises) {
    return <div className="p-6 text-muted-foreground">Você não tem acesso a esta área.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Inventário</h1>
        {canReports && (
          <Button variant="outline" onClick={() => setReportsOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Relatórios
          </Button>
        )}
      </div>

      {!activeInventory && (
        <>
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Iniciar novo inventário</h2>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label>Código da prateleira</Label>
                <Input
                  placeholder="Ex: F7E"
                  value={shelfCode}
                  onChange={(e) => setShelfCode(e.target.value)}
                />
              </div>
              <Button onClick={handleStart} disabled={!shelfCode.trim()}>
                <Play className="w-4 h-4 mr-2" />
                Iniciar
              </Button>
            </div>
          </Card>

          {inProgress.length > 0 && (
            <Card className="p-4 space-y-2">
              <h2 className="font-semibold">Em andamento</h2>
              {inProgress.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">Prateleira {inv.shelf_code}</div>
                    <div className="text-xs text-muted-foreground">
                      Iniciado por {inv.started_by_name} —{' '}
                      {new Date(inv.started_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  {(inv.started_by_id === currentUser?.id || isAdmin) && (
                    <Button size="sm" variant="outline" onClick={() => setActiveInventory(inv)}>
                      Continuar
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {activeInventory && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Prateleira em inventário</div>
              <div className="text-xl font-bold">{activeInventory.shelf_code}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>

          {activeInventory.locations.length > 0 && (
            <div className="space-y-1 text-sm border rounded p-2 bg-muted/30">
              <div className="font-medium">Localizações já salvas:</div>
              {activeInventory.locations.map((loc, idx) => (
                <div key={idx} className="text-xs">
                  <strong>{loc.location_code}</strong> — {loc.items.length} item(ns)
                </div>
              ))}
            </div>
          )}

          <div>
            <Label>Código de localização</Label>
            <Input
              placeholder="Ex: F7E-1/A"
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Itens</Label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <label
                  className="col-span-1 flex items-center justify-center h-10 rounded-md border border-input bg-background cursor-pointer hover:bg-accent transition-colors"
                  title="Ler etiqueta com a câmera"
                >
                  {scanningIdx === idx ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={scanningIdx !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.currentTarget.value = '';
                      handleScan(idx, f);
                    }}
                  />
                </label>
                <Input
                  className="col-span-4"
                  placeholder="Código"
                  value={it.code}
                  onChange={(e) => updateItem(idx, 'code', e.target.value)}
                />
                <Input
                  className="col-span-3"
                  placeholder="Tipo do item"
                  value={it.type}
                  onChange={(e) => updateItem(idx, 'type', e.target.value)}
                />
                <Input
                  className="col-span-3"
                  placeholder="Qtd"
                  type="number"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                />
                <Button
                  className="col-span-1"
                  variant="ghost"
                  size="icon"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addItemFields}>
              <Plus className="w-4 h-4 mr-1" /> Novo item
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap pt-2 border-t">
            <Button variant="outline" onClick={handleAddAnotherLocation}>
              Salvar localização e adicionar outra
            </Button>
            <Button onClick={handleFinalize}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Finalizar inventário
            </Button>
          </div>
        </Card>
      )}

      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatórios de Inventário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {completed.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum relatório ainda.</div>
            )}
            {completed.map((inv) => {
              const totalItems = inv.locations.reduce((s, l) => s + l.items.length, 0);
              return (
                <Card
                  key={inv.id}
                  className="p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setDetailInv(inv)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Prateleira {inv.shelf_code}</div>
                      <div className="text-xs text-muted-foreground">
                        Realizado por {inv.started_by_name} —{' '}
                        {inv.finished_at ? new Date(inv.finished_at).toLocaleString('pt-BR') : '-'}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inv.locations.length} loc. • {totalItems} item(ns)
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailInv} onOpenChange={(o) => !o && setDetailInv(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailInv ? `Prateleira ${detailInv.shelf_code}` : ''}</DialogTitle>
          </DialogHeader>
          {detailInv && (
            <div>
              <div className="text-xs text-muted-foreground mb-3">
                Realizado por {detailInv.started_by_name} —{' '}
                {detailInv.finished_at
                  ? new Date(detailInv.finished_at).toLocaleString('pt-BR')
                  : '-'}
              </div>
              {detailInv.locations.map((loc, idx) => (
                <div key={idx} className="border-t pt-2 mt-2">
                  <div className="font-medium text-sm">Localização: {loc.location_code}</div>
                  <ul className="text-xs list-disc pl-5">
                    {loc.items.map((it, i) => (
                      <li key={i}>
                        Código <strong>{it.code}</strong> — {it.type} — Qtd:{' '}
                        <strong>{it.quantity}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
