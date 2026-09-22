import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { Plus, Play, FileText, CheckCircle2, Trash2, X, Camera, Loader2 } from 'lucide-react';
import { Sector } from '@/types';
import { parseInventoryLabelApi } from '@/lib/api';

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
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    action: () => void | Promise<void>;
  } | null>(null);

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
      const data = await parseInventoryLabelApi({
        imageBase64: base64,
        mimeType,
      });
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
    // Mantido por compatibilidade; o listener abaixo já mantém a lista atualizada.
  };

  useEffect(() => {
    const inventoriesQuery = query(collection(db, 'inventories'), orderBy('started_at', 'desc'));

    const unsubscribe = onSnapshot(
      inventoriesQuery,
      (snapshot) => {
        setInventories(
          snapshot.docs.map((inventoryDoc) => {
            const data = inventoryDoc.data();
            return {
              id: inventoryDoc.id,
              shelf_code: data.shelf_code || '',
              status: data.status || 'in_progress',
              started_by_id: data.started_by_id || '',
              started_by_name: data.started_by_name || '',
              locations: Array.isArray(data.locations) ? data.locations : [],
              started_at: data.started_at?.toDate
                ? data.started_at.toDate().toISOString()
                : data.started_at || '',
              finished_at: data.finished_at?.toDate
                ? data.finished_at.toDate().toISOString()
                : data.finished_at || null,
              popup_id: data.popup_id || null,
              task_id: data.task_id || null,
            } as any;
          })
        );
      },
      (error) => console.error('Erro ao carregar inventários:', error)
    );

    return () => unsubscribe();
  }, []);

  const handleStart = async () => {
    if (!shelfCode.trim() || !currentUser) return;
    const shelf = shelfCode.trim().toUpperCase();

    try {
      const inventoryRef = await addDoc(collection(db, 'inventories'), {
        shelf_code: shelf,
        status: 'in_progress',
        started_by_id: currentUser.id,
        started_by_name: currentUser.name,
        locations: [],
        started_at: Timestamp.now(),
        finished_at: null,
      });

      const popupRef = await addDoc(collection(db, 'admin_popups'), {
        title: `📦 Inventário em andamento - Prateleira ${shelf}`,
        content: `A prateleira ${shelf} está em processo de inventário.

Se precisar de algum item dela, entre em contato com o Estoque antes de retirar.

Iniciado por ${currentUser.name}.`,
        created_by: currentUser.id,
        target_mode: 'all',
        target_sectors: [],
        target_users: [],
        attachments: [],
        created_at: Timestamp.now(),
      });

      await updateDoc(doc(db, 'inventories', inventoryRef.id), {
        popup_id: popupRef.id,
        updated_at: Timestamp.now(),
      });

      const inv = {
        id: inventoryRef.id,
        shelf_code: shelf,
        status: 'in_progress' as const,
        started_by_id: currentUser.id,
        started_by_name: currentUser.name,
        locations: [],
        started_at: new Date().toISOString(),
        finished_at: null,
        popup_id: popupRef.id,
      } as any;

      setShelfCode('');
      setActiveInventory(inv);
      setLocationCode('');
      setItems(Array.from({ length: 5 }, emptyItem));
      toast.success('Inventário iniciado e equipe notificada');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao iniciar inventário');
      return;
    }
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
    try {
      await updateDoc(doc(db, 'inventories', activeInventory.id), {
        locations: newLocations,
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar localização');
      return null;
    }
    const updated = { ...activeInventory, locations: newLocations } as Inventory;
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
    const taskRef = await addDoc(collection(db, 'tasks'), {
      title: `📋 Baixa de Inventário - Prateleira ${finalInv.shelf_code}`,
      description: `Realizar a baixa no sistema referente ao inventário da prateleira ${finalInv.shelf_code}.

${reportText}`,
      status: 'todo',
      priority: 'medium',
      assignee_id: MOISES_ID,
      created_by: currentUser.id,
      deadline: '',
      sector: 'estoque',
      status_history: [{ status: 'todo', enteredAt: new Date().toISOString() }],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });

    await updateDoc(doc(db, 'inventories', finalInv.id), {
      status: 'completed',
      finished_at: Timestamp.now(),
      task_id: taskRef.id,
      updated_at: Timestamp.now(),
    });

    await addDoc(collection(db, 'notifications'), {
      user_id: MOISES_ID,
      message: `Nova baixa de inventário disponível — Prateleira ${finalInv.shelf_code}`,
      type: 'task_created',
      read: false,
      created_at: Timestamp.now(),
    });

    if ((finalInv as any).popup_id) {
      await deleteDoc(doc(db, 'admin_popups', (finalInv as any).popup_id));
    }

    toast.success('Inventário finalizado e tarefa enviada a Moisés');
    setActiveInventory(null);
    setLocationCode('');
    setItems(Array.from({ length: 5 }, emptyItem));
  };

  const handleCancel = async () => {
    if (!activeInventory) return;
    if ((activeInventory as any).popup_id) {
      await deleteDoc(doc(db, 'admin_popups', (activeInventory as any).popup_id));
    }
    await deleteDoc(doc(db, 'inventories', activeInventory.id));
    setActiveInventory(null);
    setLocationCode('');
    setItems(Array.from({ length: 5 }, emptyItem));
    toast.success('Inventário cancelado');
  };

  const inProgress = inventories.filter((i) => i.status === 'in_progress');
  const completed = inventories.filter((i) => i.status === 'completed');

  if (!isAdmin && !isEstoque && !isMoises) {
    return (
      <div className="jf-surface p-6 text-center text-sm text-muted-foreground">
        Você não tem acesso a esta área.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 md:space-y-6">
      <section className="jf-surface overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Controle de estoque
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Inventário
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Registre prateleiras, localizações e itens com apoio de leitura por câmera.
            </p>
          </div>

          {canReports && (
            <Button variant="outline" onClick={() => setReportsOpen(true)}>
              <FileText className="h-4 w-4" />
              Relatórios
            </Button>
          )}
        </div>
      </section>

      {!activeInventory && (
        <>
          <Card className="space-y-4 p-4 md:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Nova contagem
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                Iniciar novo inventário
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Label>Código da prateleira</Label>
                <Input
                  placeholder="Ex: F7E"
                  value={shelfCode}
                  onChange={(e) => setShelfCode(e.target.value)}
                />
              </div>
              <Button onClick={handleStart} disabled={!shelfCode.trim()}>
                <Play className="h-4 w-4" />
                Iniciar
              </Button>
            </div>
          </Card>

          {inProgress.length > 0 && (
            <Card className="space-y-3 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">
                    Sessões ativas
                  </p>
                  <h2 className="mt-1 text-base font-semibold">Em andamento</h2>
                </div>
                <span className="rounded-lg bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                  {inProgress.length}
                </span>
              </div>
              {inProgress.map((inv) => (
                <div
                  key={inv.id}
                  className="jf-interactive flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/10 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
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
        <Card className="space-y-5 p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Prateleira em inventário</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {activeInventory.shelf_code}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setConfirmAction({
                  title: 'Cancelar inventário',
                  description:
                    'Os dados informados neste inventário serão descartados definitivamente.',
                  confirmLabel: 'Cancelar inventário',
                  destructive: true,
                  action: handleCancel,
                })
              }
            >
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </div>

          {activeInventory.locations.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm">
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
              <div
                key={idx}
                className="grid grid-cols-12 items-center gap-2 rounded-xl border border-border/60 bg-muted/10 p-2"
              >
                <label
                  className="jf-interactive col-span-2 flex h-11 cursor-pointer items-center justify-center rounded-xl border border-input bg-card hover:bg-muted sm:col-span-1"
                  title="Ler etiqueta com a câmera"
                >
                  {scanningIdx === idx ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
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
                  className="col-span-10 sm:col-span-4"
                  placeholder="Código"
                  value={it.code}
                  onChange={(e) => updateItem(idx, 'code', e.target.value)}
                />
                <Input
                  className="col-span-6 sm:col-span-3"
                  placeholder="Tipo do item"
                  value={it.type}
                  onChange={(e) => updateItem(idx, 'type', e.target.value)}
                />
                <Input
                  className="col-span-4 sm:col-span-3"
                  placeholder="Qtd"
                  type="number"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                />
                <Button
                  className="col-span-2 sm:col-span-1"
                  variant="ghost"
                  size="icon"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addItemFields}>
              <Plus className="h-4 w-4" /> Novo item
            </Button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap">
            <Button variant="outline" onClick={handleAddAnotherLocation}>
              Salvar localização e adicionar outra
            </Button>
            <Button onClick={handleFinalize}>
              <CheckCircle2 className="h-4 w-4" />
              Finalizar inventário
            </Button>
          </div>
        </Card>
      )}

      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-2xl">
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
                  className="jf-interactive cursor-pointer p-3.5 hover:bg-muted/25"
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
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-2xl">
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
                <div key={idx} className="mt-3 border-t border-border/70 pt-3">
                  <div className="font-medium text-sm">Localização: {loc.location_code}</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
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

export default InventoryPage;
