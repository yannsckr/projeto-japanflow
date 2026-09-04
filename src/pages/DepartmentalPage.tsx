import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useDepartmental } from '@/hooks/useDepartmental';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Truck,
  Receipt,
  ShoppingCart,
  AlertTriangle,
  Wrench,
  Bike,
  Plus,
  ThumbsUp,
  Send,
  CheckCircle2,
  Clock,
  Play,
  Trash2,
  Search,
  X,
  Pencil,
  Shield,
  Layers,
  CalendarClock,
  UserX,
  UserPlus,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import WarrantiesPanel from '@/components/WarrantiesPanel';
import UnifyRidesDialog from '@/components/UnifyRidesDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SECTOR_LABELS, Sector } from '@/types';
import { parseOrderInfo, stripOrderInfo, OrderInfoBadges } from '@/lib/orderInfo';
import { uploadImage } from '@/lib/uploadImage';

const MotoboyTimer = ({ startTime }: { startTime: string }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);
  const ms = Date.now() - new Date(startTime).getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0)
    return (
      <span>
        {days}d {hours % 24}h
      </span>
    );
  if (hours > 0)
    return (
      <span>
        {hours}h {mins % 60}m
      </span>
    );
  return <span>{mins}m</span>;
};

const DepartmentalPage = () => {
  const { currentUser, users } = useApp();
  const dept = useDepartmental();
  const featPerms = useFeaturePermissions();
  const isAdmin = currentUser?.role === 'admin';
  const userSectors = currentUser?.sectors || [];
  const canManageMotoboy =
    isAdmin ||
    currentUser?.id === 'emp-1' ||
    featPerms.hasFeature(currentUser?.id, 'motoboy_management');
  const canRequestReverse =
    isAdmin ||
    userSectors.some((s) => ['vendas'].includes(s)) ||
    featPerms.hasFeature(currentUser?.id, 'request_reverse');
  const canManageTrackingWarranty =
    isAdmin ||
    currentUser?.id === 'emp-12' ||
    featPerms.hasFeature(currentUser?.id, 'tracking_warranties');

  // Determine which tabs user can see
  const canSeeTracking = isAdmin || userSectors.some((s) => ['expedicao', 'vendas'].includes(s));
  const canPostTracking =
    isAdmin || userSectors.includes('expedicao' as Sector) || canManageTrackingWarranty;
  const canSeeReverse = isAdmin || userSectors.some((s) => ['vendas', 'expedicao'].includes(s));
  const canSeeReceipts = isAdmin || userSectors.some((s) => ['motoboys', 'expedicao'].includes(s));
  const canPostReceipts = userSectors.includes('motoboys' as Sector);
  const canSeeQuotes =
    isAdmin ||
    userSectors.includes('compras' as Sector) ||
    dept.counterQuotes.some((cq) => cq.requestedBy === currentUser?.id);
  const canSeeLowStock =
    isAdmin || userSectors.some((s) => ['expedicao', 'compras', 'estoque'].includes(s));
  const canSeeSupplies = true; // All employees
  const canSeeMotoboy = isAdmin || userSectors.some((s) => ['expedicao', 'motoboys'].includes(s));
  const canSeeWarranties =
    isAdmin || userSectors.some((s) => ['garantias', 'vendas', 'expedicao'].includes(s));

  // Dialog states
  const [dialog, setDialog] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [trackingSearchClient, setTrackingSearchClient] = useState('');
  const [trackingSearchDate, setTrackingSearchDate] = useState('');
  const [motoboySearch, setMotoboySearch] = useState('');
  const [motoboyFilterDate, setMotoboyFilterDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [motoboyFilterUser, setMotoboyFilterUser] = useState('all');
  const [motoboyLoading, setMotoboyLoading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [unifyOpen, setUnifyOpen] = useState(false);

  const filteredTracking = dept.tracking.filter((t) => {
    const matchClient =
      !trackingSearchClient ||
      (t.clientName || '').toLowerCase().includes(trackingSearchClient.toLowerCase());
    const matchDate =
      !trackingSearchDate ||
      new Date(t.createdAt).toLocaleDateString('pt-BR') ===
        new Date(trackingSearchDate + 'T12:00:00').toLocaleDateString('pt-BR');
    return matchClient && matchDate;
  });

  if (!currentUser) return null;

  const getName = (id: string) => users.find((u) => u.id === id)?.name || id;
  const motoboys = users.filter((u) => u.sectors?.includes('motoboys' as Sector));

  const resetDialog = () => {
    setDialog(null);
    setForm({});
  };

  // Handlers
  const handleAddTracking = async () => {
    if (!form.code?.trim() || !form.clientName?.trim() || !form.shippingMethod?.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    await dept.addTracking(
      form.code.trim(),
      form.desc?.trim() || '',
      currentUser.id,
      form.clientName.trim(),
      form.shippingMethod.trim()
    );
    toast.success('Rastreamento adicionado');
    resetDialog();
  };

  const handleRequestReverse = async () => {
    if (
      !form.reverseInvoice?.trim() ||
      !form.reverseItemName?.trim() ||
      !form.reverseItemValue ||
      !form.reverseSaleDate ||
      !form.reverseReason
    ) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (form.reverseReason !== 'Arrependimento' && !form.reverseProductImage) {
      toast.error('Anexe uma imagem do produto para verificação');
      return;
    }
    try {
      let productImageUrl: string | null = null;
      if (form.reverseProductImage) {
        const file = form.reverseProductImage as File;
        try {
          const { publicUrl } = await uploadImage(file, {
            pathPrefix: 'reverse-shipments',
            sourceTable: 'reverse_shipments',
            sourceField: 'product_image_url',
            uploadedBy: currentUser.id,
          });
          productImageUrl = publicUrl;
        } catch {
          /* ignore */
        }
      }
      await dept.requestReverseShipment({
        invoiceNumber: form.reverseInvoice.trim(),
        itemName: form.reverseItemName.trim(),
        itemValue: parseFloat(form.reverseItemValue),
        saleDate: form.reverseSaleDate,
        returnReason: form.reverseReason,
        productImageUrl,
        requestedBy: currentUser.id,
      });
      toast.success('Envio reverso solicitado');
      resetDialog();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao solicitar envio reverso');
    }
  };

  const handleRespondReverse = async (id: string) => {
    if (!form[`code_${id}`]?.trim()) return;
    await dept.respondReverseShipment(id, form[`code_${id}`].trim(), currentUser.id);
    toast.success('Código enviado');
    setForm((prev: any) => ({ ...prev, [`code_${id}`]: '' }));
  };

  const handleAddReceipt = async () => {
    let photoUrl: string | null = null;
    if (form.photo) {
      const file = form.photo as File;
      try {
        const { publicUrl } = await uploadImage(file, {
          pathPrefix: 'receipts',
          sourceTable: 'receipts',
          sourceField: 'photo_url',
          uploadedBy: currentUser.id,
        });
        photoUrl = publicUrl;
      } catch {
        /* ignore */
      }
    }
    await dept.addReceipt(form.desc?.trim() || '', photoUrl, currentUser.id);
    toast.success('Notinha enviada');
    resetDialog();
  };

  const handleRequestQuote = async () => {
    if (!form.product?.trim()) return;
    await dept.requestQuote(
      form.product.trim(),
      form.desc?.trim() || '',
      form.qty || 1,
      currentUser.id
    );
    toast.success('Orçamento solicitado');
    resetDialog();
  };

  const handleRespondQuote = async (id: string) => {
    if (!form[`resp_${id}`]?.trim()) return;
    await dept.respondQuote(id, form[`resp_${id}`].trim(), currentUser.id);
    toast.success('Resposta enviada');
    setForm((prev: any) => ({ ...prev, [`resp_${id}`]: '' }));
  };

  const handleReportLowStock = async () => {
    let photoUrl: string | null = null;
    if (form.photo) {
      const file = form.photo as File;
      try {
        const { publicUrl } = await uploadImage(file, {
          pathPrefix: 'low-stock',
          sourceTable: 'low_stock_reports',
          sourceField: 'photo_url',
          uploadedBy: currentUser.id,
        });
        photoUrl = publicUrl;
      } catch {
        /* ignore */
      }
    }
    await dept.reportLowStock('', form.desc?.trim() || '', photoUrl, currentUser.id);
    toast.success('Produto reportado');
    resetDialog();
  };

  const handleRequestSupply = async () => {
    if (!form.item?.trim()) return;
    await dept.requestSupply(
      form.item.trim(),
      form.desc?.trim() || '',
      form.qty || 1,
      currentUser.id
    );
    toast.success('Solicitação enviada');
    resetDialog();
  };

  const handleAssignMotoboy = async () => {
    if (!form.desc?.trim()) {
      toast.error('Preencha a descrição');
      return;
    }
    const isScheduled = !!form.scheduleEnabled;
    if (!isScheduled && !form.assignee) {
      toast.error('Selecione um motoboy');
      return;
    }
    let scheduledFor: string | null = null;
    if (isScheduled) {
      if (!form.scheduleDate || !form.scheduleTime) {
        toast.error('Informe data e hora do agendamento');
        return;
      }
      const dt = new Date(`${form.scheduleDate}T${form.scheduleTime}:00`);
      if (isNaN(dt.getTime())) {
        toast.error('Data/hora inválida');
        return;
      }
      scheduledFor = dt.toISOString();
    }
    setMotoboyLoading(true);
    try {
      const value = parseFloat(String(form.rideValue || '0').replace(',', '.')) || 0;
      const desc = form.desc.trim();
      const assigneeId = form.assignee || currentUser.id;
      const clientName = form.clientName?.trim() || '';
      const location = form.location?.trim() || '';
      const userId = currentUser.id;
      await dept.assignMotoboy(desc, assigneeId, userId, value, clientName, location, scheduledFor);
      toast.success(isScheduled ? 'Corrida agendada!' : 'Tarefa atribuída');
      resetDialog();
    } catch (err: any) {
      toast.error(`Erro ao criar corrida: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setMotoboyLoading(false);
    }
  };

  const availableTabs = [
    canSeeTracking && { id: 'tracking', label: 'Rastreamento', icon: Package },
    canSeeReverse && { id: 'reverse', label: 'Envios Reversos', icon: Truck },
    canSeeReceipts && { id: 'receipts', label: 'Notinhas', icon: Receipt },
    canSeeQuotes && { id: 'quotes', label: 'Orçamentos', icon: ShoppingCart },
    canSeeLowStock && { id: 'lowstock', label: 'Esgotando', icon: AlertTriangle },
    canSeeSupplies && { id: 'supplies', label: 'Suprimentos', icon: Wrench },
    canSeeMotoboy && { id: 'motoboy', label: 'Motoboys', icon: Bike },
    canSeeWarranties && { id: 'warranties', label: 'Garantias', icon: Shield },
  ].filter(Boolean) as { id: string; label: string; icon: any }[];

  if (availableTabs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Você não tem acesso a módulos departamentais. Peça ao administrador para configurar seus
        setores.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Módulos Departamentais</h2>

      <Tabs defaultValue={availableTabs[0].id}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {availableTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
              <tab.icon className="w-3 h-3 mr-1" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Rastreamento */}
        {canSeeTracking && (
          <TabsContent value="tracking" className="space-y-3">
            {canPostTracking && (
              <Button size="sm" onClick={() => setDialog('tracking')}>
                <Plus className="w-3 h-3 mr-1" />
                Novo Rastreamento
              </Button>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente..."
                  value={trackingSearchClient}
                  onChange={(e) => setTrackingSearchClient(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
                {trackingSearchClient && (
                  <button
                    onClick={() => setTrackingSearchClient('')}
                    className="absolute right-2.5 top-2.5"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <Input
                type="date"
                value={trackingSearchDate}
                onChange={(e) => setTrackingSearchDate(e.target.value)}
                className="h-9 text-sm w-full sm:w-40"
              />
              {trackingSearchDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTrackingSearchDate('')}
                  className="h-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {filteredTracking.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum rastreamento encontrado
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredTracking.map((t) => {
                  const canDeleteTracking =
                    isAdmin ||
                    (currentUser?.id === 'emp-12' && t.createdBy === 'emp-12') ||
                    (canManageTrackingWarranty && t.createdBy === currentUser?.id);
                  return (
                    <div
                      key={t.id}
                      className="bg-card border border-border rounded-lg p-3 relative"
                    >
                      <p className="text-sm font-mono font-semibold pr-7">{t.trackingCode}</p>
                      {t.clientName && (
                        <p className="text-xs font-medium text-foreground">
                          Cliente: {t.clientName}
                        </p>
                      )}
                      {t.shippingMethod && (
                        <p className="text-xs text-muted-foreground">
                          Modalidade: {t.shippingMethod}
                        </p>
                      )}
                      {t.description && (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {getName(t.createdBy)} • {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                      {canDeleteTracking && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-1.5 right-1.5 h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm('Excluir este rastreamento?')) dept.deleteTracking(t.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        {/* Envios Reversos */}
        {canSeeReverse && (
          <TabsContent value="reverse" className="space-y-3">
            {canRequestReverse ? (
              <Button size="sm" onClick={() => setDialog('reverse')}>
                <Plus className="w-3 h-3 mr-1" />
                Solicitar Envio Reverso
              </Button>
            ) : null}
            {dept.reverseShipments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação</p>
            ) : (
              <div className="space-y-2">
                {dept.reverseShipments.map((rs) => {
                  const saleDateObj = rs.saleDate ? new Date(rs.saleDate + 'T12:00:00') : null;
                  const daysSinceSale = saleDateObj
                    ? Math.floor((Date.now() - saleDateObj.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  let warning = '';
                  if (rs.returnReason === 'Arrependimento' && daysSinceSale > 7)
                    warning =
                      'Não é devida a devolução por arrependimento (prazo de 7 dias excedido).';
                  else if (rs.returnReason === 'Troca' && daysSinceSale > 30)
                    warning = 'Deve ser verificado com um superior (prazo de 30 dias excedido).';
                  else if (rs.returnReason === 'Garantia' && daysSinceSale > 90)
                    warning = 'Verificar se o prazo de garantia confere (mais de 90 dias).';

                  return (
                    <div key={rs.id} className="bg-card border border-border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{rs.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            NF/Pedido: {rs.invoiceNumber} • Motivo: {rs.returnReason}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Valor: R$ {rs.itemValue?.toFixed(2)} • Venda:{' '}
                            {rs.saleDate
                              ? new Date(rs.saleDate + 'T12:00:00').toLocaleDateString('pt-BR')
                              : '-'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {getName(rs.requestedBy)} •{' '}
                            {new Date(rs.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        {rs.productImageUrl && (
                          <img
                            src={rs.productImageUrl}
                            alt="Produto"
                            className="w-12 h-12 rounded object-cover ml-2 cursor-pointer"
                            onClick={() => window.open(rs.productImageUrl!, '_blank')}
                          />
                        )}
                      </div>
                      {warning && (
                        <p className="text-xs text-red-500 font-semibold mt-1">⚠️ {warning}</p>
                      )}
                      {rs.trackingCode ? (
                        <p className="text-xs mt-1 font-mono text-primary">
                          Código: {rs.trackingCode}
                        </p>
                      ) : userSectors.includes('expedicao' as Sector) || isAdmin ? (
                        <div className="flex gap-2 mt-2">
                          <Input
                            size={1}
                            placeholder="Código..."
                            value={form[`code_${rs.id}`] || ''}
                            onChange={(e) =>
                              setForm((p: any) => ({ ...p, [`code_${rs.id}`]: e.target.value }))
                            }
                            className="flex-1 h-8 text-xs"
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleRespondReverse(rs.id)}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-warning mt-1">Aguardando código</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        {/* Notinhas */}
        {canSeeReceipts && (
          <TabsContent value="receipts" className="space-y-3">
            {canPostReceipts && (
              <Button size="sm" onClick={() => setDialog('receipt')}>
                <Plus className="w-3 h-3 mr-1" />
                Enviar Notinha
              </Button>
            )}
            {dept.receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notinha</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dept.receipts.map((r) => (
                  <div key={r.id} className="bg-card border border-border rounded-lg p-3">
                    {r.photoUrl && (
                      <img
                        src={r.photoUrl}
                        alt="Notinha"
                        className="w-full h-40 object-cover rounded-lg mb-2"
                      />
                    )}
                    {r.description && <p className="text-sm">{r.description}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-muted-foreground">
                        {getName(r.createdBy)} • {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                      <Button
                        size="sm"
                        variant={r.likedBy.includes(currentUser.id) ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => dept.toggleLikeReceipt(r.id, currentUser.id)}
                      >
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {r.likedBy.length}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Orçamentos */}
        {canSeeQuotes && (
          <TabsContent value="quotes" className="space-y-3">
            <Button size="sm" onClick={() => setDialog('quote')}>
              <Plus className="w-3 h-3 mr-1" />
              Solicitar Orçamento
            </Button>
            {(() => {
              // Filter: only show quotes to Compras, Admin, or the requester
              const isCompras = userSectors.includes('compras' as Sector);
              const visibleQuotes = dept.counterQuotes.filter(
                (cq) => isAdmin || isCompras || cq.requestedBy === currentUser.id
              );
              return visibleQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum orçamento</p>
              ) : (
                <div className="space-y-2">
                  {visibleQuotes.map((cq) => {
                    const canClaim =
                      !cq.claimedBy && cq.status !== 'responded' && (isCompras || isAdmin);
                    const isMyClaim = cq.claimedBy === currentUser.id;
                    const canRespond = isMyClaim && !cq.response;
                    const claimerName = cq.claimedBy ? getName(cq.claimedBy) : null;
                    const canDelete = isAdmin || isCompras || cq.requestedBy === currentUser.id;
                    return (
                      <div key={cq.id} className="bg-card border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            {cq.productName}{' '}
                            <span className="text-xs text-muted-foreground font-normal">
                              (x{cq.quantity})
                            </span>
                          </p>
                          <span
                            className={cn(
                              'text-xs px-2 py-1 rounded-full',
                              cq.status === 'responded'
                                ? 'bg-success/20 text-success'
                                : cq.claimedBy
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-warning/20 text-warning'
                            )}
                          >
                            {cq.status === 'responded'
                              ? 'Respondido'
                              : cq.claimedBy
                                ? `Em atendimento`
                                : 'Aguardando resgate'}
                          </span>
                        </div>
                        {cq.description && (
                          <p className="text-xs text-muted-foreground">{cq.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Solicitado por: {getName(cq.requestedBy)}
                        </p>
                        {claimerName && (
                          <p className="text-[10px] text-primary">Responsável: {claimerName}</p>
                        )}
                        {/* Wait timer */}
                        {cq.status !== 'responded' && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>Aguardando: </span>
                            <MotoboyTimer startTime={cq.createdAt} />
                          </div>
                        )}
                        {cq.response && (
                          <p className="text-sm mt-2 p-2 bg-primary/5 rounded-lg">
                            <span className="text-xs font-medium text-primary">Resposta:</span>{' '}
                            {cq.response}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {canClaim && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                dept.claimQuote(cq.id, currentUser.id);
                                toast.success('Orçamento resgatado!');
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Resgatar Orçamento
                            </Button>
                          )}
                          {canRespond && (
                            <div className="flex gap-2 flex-1">
                              <Input
                                placeholder="Resposta do orçamento..."
                                value={form[`resp_${cq.id}`] || ''}
                                onChange={(e) =>
                                  setForm((p: any) => ({ ...p, [`resp_${cq.id}`]: e.target.value }))
                                }
                                className="flex-1 h-8 text-xs"
                              />
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleRespondQuote(cq.id)}
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('Deseja realmente excluir este orçamento?')) {
                                  dept.deleteQuote(cq.id);
                                  toast.success('Orçamento excluído');
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        )}

        {/* Produtos Esgotando */}
        {canSeeLowStock && (
          <TabsContent value="lowstock" className="space-y-3">
            {(userSectors.includes('expedicao' as Sector) || isAdmin) && (
              <Button size="sm" onClick={() => setDialog('lowstock')}>
                <Plus className="w-3 h-3 mr-1" />
                Reportar Produto
              </Button>
            )}
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="mb-2">
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                {dept.lowStockItems.filter((i) => i.status !== 'resolved').length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum produto reportado
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dept.lowStockItems
                      .filter((i) => i.status !== 'resolved')
                      .map((item) => (
                        <div key={item.id} className="bg-card border border-border rounded-lg p-3">
                          {item.photoUrl && (
                            <img
                              src={item.photoUrl}
                              alt="Produto"
                              className="w-full h-32 object-cover rounded-lg mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setEnlargedImage(item.photoUrl)}
                            />
                          )}
                          {item.description && <p className="text-sm">{item.description}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-muted-foreground">
                              {getName(item.reportedBy)}
                            </p>
                            <div className="flex gap-1">
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => dept.resolveLowStock(item.id)}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Resolver
                                </Button>
                              )}
                              {(isAdmin || item.reportedBy === currentUser?.id) && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => dept.deleteLowStock(item.id)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Excluir
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="history">
                {dept.lowStockItems.filter((i) => i.status === 'resolved').length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum produto no histórico
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dept.lowStockItems
                      .filter((i) => i.status === 'resolved')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="bg-card border border-border rounded-lg p-3 opacity-60"
                        >
                          {item.photoUrl && (
                            <img
                              src={item.photoUrl}
                              alt="Produto"
                              className="w-full h-32 object-cover rounded-lg mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setEnlargedImage(item.photoUrl)}
                            />
                          )}
                          {item.description && <p className="text-sm">{item.description}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-muted-foreground">
                              {getName(item.reportedBy)}
                            </p>
                            <Badge variant="secondary" className="text-[10px]">
                              Resolvido
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        {/* Suprimentos */}
        <TabsContent value="supplies" className="space-y-3">
          <Button size="sm" onClick={() => setDialog('supply')}>
            <Plus className="w-3 h-3 mr-1" />
            Solicitar Material
          </Button>
          {dept.supplyRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação</p>
          ) : (
            <div className="space-y-2">
              {dept.supplyRequests.map((sr) => (
                <div
                  key={sr.id}
                  className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {sr.itemName}{' '}
                      <span className="text-xs text-muted-foreground font-normal">
                        (x{sr.quantity})
                      </span>
                    </p>
                    {sr.description && (
                      <p className="text-xs text-muted-foreground">{sr.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{getName(sr.requestedBy)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        sr.status === 'delivered'
                          ? 'bg-success/20 text-success'
                          : sr.status === 'approved'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-warning/20 text-warning'
                      )}
                    >
                      {sr.status === 'delivered'
                        ? 'Entregue'
                        : sr.status === 'approved'
                          ? 'Aprovado'
                          : 'Pendente'}
                    </span>
                    {isAdmin && sr.status === 'requested' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => dept.updateSupplyStatus(sr.id, 'approved')}
                      >
                        Aprovar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Monitoria Motoboys */}
        {canSeeMotoboy && (
          <TabsContent value="motoboy" className="space-y-3">
            {canManageMotoboy && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setDialog('motoboy')}>
                  <Plus className="w-3 h-3 mr-1" />
                  Nova Tarefa
                </Button>
                <Button size="sm" variant="outline" onClick={() => setUnifyOpen(true)}>
                  <Layers className="w-3 h-3 mr-1" />
                  Unificar Corridas
                </Button>
              </div>
            )}
            <UnifyRidesDialog
              open={unifyOpen}
              onOpenChange={setUnifyOpen}
              assignments={dept.motoboyAssignments}
              currentUserId={currentUser.id}
              getName={getName}
            />

            {/* Pending approval section for Patricia / admins */}
            {canManageMotoboy &&
              (() => {
                const pendingApproval = dept.motoboyAssignments.filter(
                  (a) => a.status === 'pending_approval'
                );
                if (pendingApproval.length === 0) return null;
                return (
                  <div className="border border-amber-300 dark:border-amber-600 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      Aguardando Aprovação ({pendingApproval.length})
                    </h4>
                    {pendingApproval.map((ma) => {
                      const fmtSchedule = (iso: string) => {
                        const d = new Date(iso);
                        return d.toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      };
                      return (
                        <div
                          key={ma.id}
                          className="bg-card border border-border rounded-lg p-3 text-sm space-y-2"
                        >
                          {ma.scheduledFor && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-destructive bg-destructive/10 border border-destructive/40 rounded px-2 py-1 animate-pulse">
                              <CalendarClock className="w-3.5 h-3.5" />
                              🔴 CORRIDA AGENDADA — {fmtSchedule(ma.scheduledFor)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{ma.description}</p>
                            {(() => {
                              const cleaned = stripOrderInfo(ma.notes);
                              return cleaned ? (
                                <p className="text-xs font-medium text-primary">{cleaned}</p>
                              ) : null;
                            })()}
                            <OrderInfoBadges
                              info={parseOrderInfo(ma.notes)}
                              size="sm"
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground">
                              Solicitado por: {getName(ma.assignedBy)}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              placeholder="Nome do cliente *"
                              value={form[`approve_client_${ma.id}`] ?? ma.clientName ?? ''}
                              onChange={(e) =>
                                setForm((prev: any) => ({
                                  ...prev,
                                  [`approve_client_${ma.id}`]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs"
                            />
                            <Input
                              placeholder="Localização *"
                              value={form[`approve_location_${ma.id}`] ?? ma.location ?? ''}
                              onChange={(e) =>
                                setForm((prev: any) => ({
                                  ...prev,
                                  [`approve_location_${ma.id}`]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs"
                            />
                            <Input
                              type="number"
                              placeholder="Valor (R$) - opcional"
                              value={
                                form[`approve_value_${ma.id}`] ??
                                (ma.rideValue > 0 ? String(ma.rideValue) : '')
                              }
                              onChange={(e) =>
                                setForm((prev: any) => ({
                                  ...prev,
                                  [`approve_value_${ma.id}`]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs"
                            />
                            <Select
                              value={form[`approve_motoboy_${ma.id}`] || ''}
                              onValueChange={(v) =>
                                setForm((prev: any) => ({
                                  ...prev,
                                  [`approve_motoboy_${ma.id}`]: v,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecionar motoboy *" />
                              </SelectTrigger>
                              <SelectContent>
                                {motoboys.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                            <Label
                              htmlFor={`sched-${ma.id}`}
                              className="flex items-center gap-1.5 text-xs cursor-pointer"
                            >
                              <CalendarClock className="w-3.5 h-3.5 text-destructive" />
                              {ma.scheduledFor ? 'Reagendar' : 'Agendar'}
                            </Label>
                            <Switch
                              id={`sched-${ma.id}`}
                              checked={!!form[`approve_sched_enabled_${ma.id}`]}
                              onCheckedChange={(v) =>
                                setForm((prev: any) => {
                                  const next = { ...prev, [`approve_sched_enabled_${ma.id}`]: v };
                                  if (
                                    v &&
                                    ma.scheduledFor &&
                                    !prev[`approve_sched_date_${ma.id}`]
                                  ) {
                                    const d = new Date(ma.scheduledFor);
                                    next[`approve_sched_date_${ma.id}`] = d
                                      .toISOString()
                                      .split('T')[0];
                                    next[`approve_sched_time_${ma.id}`] = d
                                      .toTimeString()
                                      .slice(0, 5);
                                  }
                                  return next;
                                })
                              }
                            />
                          </div>
                          {form[`approve_sched_enabled_${ma.id}`] && (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="date"
                                className="h-8 text-xs"
                                value={form[`approve_sched_date_${ma.id}`] || ''}
                                onChange={(e) =>
                                  setForm((prev: any) => ({
                                    ...prev,
                                    [`approve_sched_date_${ma.id}`]: e.target.value,
                                  }))
                                }
                              />
                              <Input
                                type="time"
                                className="h-8 text-xs"
                                value={form[`approve_sched_time_${ma.id}`] || ''}
                                onChange={(e) =>
                                  setForm((prev: any) => ({
                                    ...prev,
                                    [`approve_sched_time_${ma.id}`]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={
                                !form[`approve_motoboy_${ma.id}`] ||
                                !(form[`approve_client_${ma.id}`] ?? ma.clientName ?? '').trim() ||
                                !(form[`approve_location_${ma.id}`] ?? ma.location ?? '').trim()
                              }
                              onClick={async () => {
                                const selectedMotoboy = form[`approve_motoboy_${ma.id}`];
                                const clientName = (
                                  form[`approve_client_${ma.id}`] ??
                                  ma.clientName ??
                                  ''
                                ).trim();
                                const location = (
                                  form[`approve_location_${ma.id}`] ??
                                  ma.location ??
                                  ''
                                ).trim();
                                const rideValue =
                                  parseFloat(
                                    form[`approve_value_${ma.id}`] ??
                                      (ma.rideValue > 0 ? String(ma.rideValue) : '15')
                                  ) || 15;
                                if (!selectedMotoboy || !clientName || !location) return;

                                // If scheduling is enabled, keep status as pending_approval and persist scheduled_for
                                if (form[`approve_sched_enabled_${ma.id}`]) {
                                  const dateStr = form[`approve_sched_date_${ma.id}`];
                                  const timeStr = form[`approve_sched_time_${ma.id}`];
                                  if (!dateStr || !timeStr) {
                                    toast.error('Informe data e hora do agendamento');
                                    return;
                                  }
                                  const dt = new Date(`${dateStr}T${timeStr}:00`);
                                  if (isNaN(dt.getTime())) {
                                    toast.error('Data/hora inválida');
                                    return;
                                  }
                                  await updateDoc(doc(db, 'motoboy_assignments', ma.id), {
                                    assigned_to: selectedMotoboy,
                                    status: 'pending_approval',
                                    client_name: clientName,
                                    location,
                                    ride_value: rideValue,
                                    scheduled_for: Timestamp.fromDate(dt),
                                    updated_at: Timestamp.now(),
                                  });
                                  toast.success('Corrida agendada! Voltará para aprovação.');
                                } else {
                                  const approvalIso = new Date().toISOString();
                                  await updateDoc(doc(db, 'motoboy_assignments', ma.id), {
                                    assigned_to: selectedMotoboy,
                                    status: 'pending',
                                    client_name: clientName,
                                    location,
                                    ride_value: rideValue,
                                    scheduled_for: Timestamp.fromDate(new Date(approvalIso)),
                                    updated_at: Timestamp.now(),
                                  });
                                  const now = new Date().toISOString();
                                  const deadlineDate = new Date();
                                  deadlineDate.setHours(23, 59, 59, 999);
                                  const notesInfo = ma.notes ? `\n${ma.notes}` : '';
                                  const taskRef = await addDoc(collection(db, 'tasks'), {
                                    title: `🏍️ Entrega: ${clientName}`,
                                    description: `${ma.description} • Cliente: ${clientName} • Local: ${location} • Valor: R$ ${rideValue.toFixed(2)}${notesInfo}`,
                                    status: 'todo',
                                    priority: 'high',
                                    assignee_id: selectedMotoboy,
                                    created_by: currentUser.id,
                                    deadline: deadlineDate.toISOString().split('T')[0],
                                    sector: 'motoboys',
                                    status_history: [{ status: 'todo', enteredAt: now }],
                                    created_at: Timestamp.now(),
                                    updated_at: Timestamp.now(),
                                  });

                                  await updateDoc(doc(db, 'motoboy_assignments', ma.id), {
                                    task_id: taskRef.id,
                                    updated_at: Timestamp.now(),
                                  });
                                  toast.success('Corrida aprovada e enviada ao motoboy!');
                                }
                                setForm((prev: any) => {
                                  const next = { ...prev };
                                  delete next[`approve_motoboy_${ma.id}`];
                                  delete next[`approve_client_${ma.id}`];
                                  delete next[`approve_location_${ma.id}`];
                                  delete next[`approve_value_${ma.id}`];
                                  delete next[`approve_sched_enabled_${ma.id}`];
                                  delete next[`approve_sched_date_${ma.id}`];
                                  delete next[`approve_sched_time_${ma.id}`];
                                  return next;
                                });
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />
                              {form[`approve_sched_enabled_${ma.id}`] ? 'Agendar' : 'Aprovar'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive"
                              onClick={() => {
                                if (confirm('Recusar corrida?')) {
                                  dept.deleteMotoboyAssignment(ma.id);
                                  toast.info('Corrida recusada');
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, local ou descrição..."
                  value={motoboySearch}
                  onChange={(e) => setMotoboySearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
                {motoboySearch && (
                  <button
                    onClick={() => setMotoboySearch('')}
                    className="absolute right-2.5 top-2.5"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <Input
                type="date"
                value={motoboyFilterDate}
                onChange={(e) => setMotoboyFilterDate(e.target.value)}
                className="h-9 text-sm w-full sm:w-40"
              />
              {motoboyFilterDate !== new Date().toISOString().split('T')[0] && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMotoboyFilterDate(new Date().toISOString().split('T')[0])}
                  className="h-9 text-xs"
                >
                  Hoje
                </Button>
              )}
              {!userSectors.includes('motoboys' as Sector) || isAdmin ? (
                <Select value={motoboyFilterUser} onValueChange={setMotoboyFilterUser}>
                  <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
                    <SelectValue placeholder="Todos os motoboys" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Motoboys</SelectItem>
                    <SelectItem value="unassigned">⚠️ Sem Atribuição</SelectItem>
                    {motoboys.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            {(() => {
              const isMotoboy =
                userSectors.includes('motoboys' as Sector) &&
                !isAdmin &&
                !userSectors.includes('expedicao' as Sector);
              let visibleAssignments = isMotoboy
                ? dept.motoboyAssignments.filter(
                    (ma) =>
                      (ma.assignedTo === currentUser.id || ma.assignedTo === null) &&
                      ma.status !== 'pending_approval'
                  )
                : dept.motoboyAssignments.filter((ma) => ma.status !== 'pending_approval');

              // Apply filters
              if (motoboyFilterUser !== 'all') {
                if (motoboyFilterUser === 'unassigned')
                  visibleAssignments = visibleAssignments.filter((a) => a.assignedTo === null);
                else
                  visibleAssignments = visibleAssignments.filter(
                    (a) => a.assignedTo === motoboyFilterUser
                  );
              }
              if (motoboySearch.trim()) {
                const q = motoboySearch.toLowerCase();
                visibleAssignments = visibleAssignments.filter(
                  (a) =>
                    a.description.toLowerCase().includes(q) ||
                    (a.clientName || '').toLowerCase().includes(q) ||
                    (a.location || '').toLowerCase().includes(q)
                );
              }
              if (motoboyFilterDate)
                visibleAssignments = visibleAssignments.filter(
                  (a) => a.createdAt.split('T')[0] === motoboyFilterDate
                );

              // Group by motoboy (use 'unassigned' bucket for null)
              const grouped: Record<string, typeof visibleAssignments> = {};
              visibleAssignments.forEach((ma) => {
                const key = ma.assignedTo ?? 'unassigned';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(ma);
              });
              // Render unassigned bucket first when present
              const motoboyIds = Object.keys(grouped).sort((a, b) =>
                a === 'unassigned' ? -1 : b === 'unassigned' ? 1 : 0
              );

              if (visibleAssignments.length === 0)
                return (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma tarefa encontrada
                  </p>
                );

              return (
                <div
                  className={cn(
                    'grid gap-4',
                    motoboyIds.length >= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  {motoboyIds.map((motoboyId) => {
                    const isUnassignedGroup = motoboyId === 'unassigned';
                    return (
                      <div
                        key={motoboyId}
                        className={cn(
                          'space-y-2',
                          isUnassignedGroup && 'p-2 rounded-lg ring-2 ring-warning/60 bg-warning/5'
                        )}
                      >
                        <h4 className="text-sm font-semibold flex items-center gap-1.5 border-b border-border pb-1">
                          <Bike
                            className={cn(
                              'w-3.5 h-3.5',
                              isUnassignedGroup ? 'text-warning' : 'text-primary'
                            )}
                          />
                          {isUnassignedGroup
                            ? '⚠️ Sem Atribuição (Disponível para Redistribuição)'
                            : getName(motoboyId)}
                          <span className="text-xs text-muted-foreground font-normal ml-auto">
                            {grouped[motoboyId].length} corrida(s)
                          </span>
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {grouped[motoboyId].map((ma) => {
                            const assignedMs = Date.now() - new Date(ma.createdAt).getTime();
                            const isIdle = ma.status !== 'completed' && assignedMs > 20 * 60000;
                            const formatTime = (iso: string | null) =>
                              iso
                                ? new Date(iso).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '--:--';
                            return (
                              <div
                                key={ma.id}
                                className={cn(
                                  'bg-card border border-border rounded-lg p-2 text-[11px]',
                                  isIdle && 'ring-1 ring-destructive/50'
                                )}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className="font-medium truncate leading-tight">
                                    {ma.description}
                                  </p>
                                  <span
                                    className={cn(
                                      'text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0',
                                      ma.status === 'completed'
                                        ? 'bg-success/20 text-success'
                                        : ma.status === 'pending'
                                          ? 'bg-warning/20 text-warning'
                                          : 'bg-primary/20 text-primary'
                                    )}
                                  >
                                    {ma.status === 'completed'
                                      ? 'OK'
                                      : ma.status === 'pending'
                                        ? 'Pend.'
                                        : 'Exec.'}
                                  </span>
                                </div>
                                {(() => {
                                  const cleaned = stripOrderInfo(ma.notes);
                                  return cleaned ? (
                                    <p className="text-muted-foreground truncate font-medium">
                                      📋 {cleaned}
                                    </p>
                                  ) : null;
                                })()}
                                <OrderInfoBadges
                                  info={parseOrderInfo(ma.notes)}
                                  size="xs"
                                  className="mt-0.5"
                                />
                                {ma.clientName && (
                                  <p className="text-muted-foreground truncate">
                                    👤 {ma.clientName}
                                  </p>
                                )}
                                {ma.location && (
                                  <p className="text-muted-foreground truncate">📍 {ma.location}</p>
                                )}
                                {ma.rideValue > 0 && (
                                  <p className="font-semibold text-primary">
                                    {ma.rideValue.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </p>
                                )}
                                <div className="text-[9px] text-muted-foreground mt-0.5 space-y-0">
                                  <span>
                                    📌{formatTime(ma.createdAt)} ✅{formatTime(ma.completedAt)}
                                  </span>
                                </div>
                                {ma.status !== 'completed' && (
                                  <div
                                    className={cn(
                                      'flex items-center gap-1 text-[10px]',
                                      isIdle
                                        ? 'text-destructive font-semibold'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    <MotoboyTimer startTime={ma.acceptedAt || ma.createdAt} />
                                    {isIdle && (
                                      <AlertTriangle className="w-2.5 h-2.5 animate-pulse" />
                                    )}
                                  </div>
                                )}
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {ma.assignedTo === null &&
                                    (userSectors.includes('motoboys' as Sector) ||
                                      canManageMotoboy) && (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="h-5 text-[9px] px-1.5"
                                        onClick={async () => {
                                          await dept.updateMotoboyAssignment(ma.id, {
                                            assignedTo: currentUser.id,
                                          });
                                          toast.success('Corrida atribuída a você');
                                        }}
                                      >
                                        <UserPlus className="w-2.5 h-2.5 mr-0.5" />
                                        Pegar Corrida
                                      </Button>
                                    )}
                                  {ma.status === 'pending' &&
                                    ma.assignedTo &&
                                    (currentUser.id === ma.assignedTo || isAdmin) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-5 text-[9px] px-1.5"
                                        onClick={() => dept.updateMotoboyStatus(ma.id, 'accepted')}
                                      >
                                        <Play className="w-2.5 h-2.5 mr-0.5" />
                                        Aceitar
                                      </Button>
                                    )}
                                  {ma.status === 'accepted' &&
                                    (currentUser.id === ma.assignedTo || isAdmin) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-5 text-[9px] px-1.5"
                                        onClick={() => {
                                          const input = document.createElement('input');
                                          input.type = 'file';
                                          input.accept = 'image/*';
                                          input.capture = 'environment';
                                          input.onchange = async (ev: any) => {
                                            const file = ev.target.files?.[0];
                                            if (!file) return;
                                            try {
                                              const { publicUrl } = await uploadImage(file, {
                                                pathPrefix: 'receipts',
                                                sourceTable: 'motoboy_assignments',
                                                sourceId: ma.id,
                                                sourceField: 'notes',
                                                uploadedBy: currentUser.id,
                                              });
                                              await dept.updateMotoboyStatus(
                                                ma.id,
                                                'completed',
                                                ma.notes
                                                  ? `${ma.notes}\nCupom: ${publicUrl}`
                                                  : `Cupom: ${publicUrl}`
                                              );
                                              toast.success('Corrida concluída com foto!');
                                            } catch {
                                              toast.error('Erro ao enviar foto');
                                            }
                                          };
                                          input.click();
                                        }}
                                      >
                                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                                        Concluir
                                      </Button>
                                    )}
                                  {canManageMotoboy && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-5 text-[9px] px-1.5"
                                      onClick={() => {
                                        setForm((prev: any) => {
                                          const baseDt = ma.scheduledFor || ma.createdAt;
                                          const d = baseDt ? new Date(baseDt) : new Date();
                                          const pad = (n: number) => String(n).padStart(2, '0');
                                          const editDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                                          const editTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                          return {
                                            ...prev,
                                            editId: ma.id,
                                            editDesc: ma.description,
                                            editClient: ma.clientName || '',
                                            editLocation: ma.location || '',
                                            editValue: ma.rideValue > 0 ? String(ma.rideValue) : '',
                                            editNotes: ma.notes || '',
                                            editAssignee: ma.assignedTo,
                                            editDate,
                                            editTime,
                                          };
                                        });
                                        setDialog('editMotoboy');
                                      }}
                                    >
                                      <Pencil className="w-2.5 h-2.5 mr-0.5" />
                                      Editar
                                    </Button>
                                  )}
                                  {canManageMotoboy &&
                                    ma.assignedTo &&
                                    ma.status !== 'completed' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-5 text-[9px] px-1.5 text-warning hover:text-warning"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              'Retirar esta corrida do motoboy? Ela voltará para a fila de redistribuição.'
                                            )
                                          ) {
                                            dept.unassignMotoboy(ma.id);
                                            toast.success(
                                              'Corrida desatribuída — disponível para redistribuição'
                                            );
                                          }
                                        }}
                                      >
                                        <UserX className="w-2.5 h-2.5 mr-0.5" />
                                        Desatribuir
                                      </Button>
                                    )}
                                  {canManageMotoboy && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-5 text-[9px] px-1.5 text-destructive hover:text-destructive"
                                      onClick={() => {
                                        if (confirm('Excluir corrida?')) {
                                          dept.deleteMotoboyAssignment(ma.id);
                                          toast.success('Excluída');
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        )}

        {/* Garantias */}
        {canSeeWarranties && (
          <TabsContent value="warranties">
            <WarrantiesPanel />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <Dialog open={dialog === 'tracking'} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Rastreamento</DialogTitle>
          </DialogHeader>
          <Input
            value={form.clientName || ''}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            placeholder="Nome do Cliente *"
          />
          <Input
            value={form.code || ''}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="Código de rastreamento *"
          />
          <Select
            value={form.shippingMethod || ''}
            onValueChange={(v) => setForm({ ...form, shippingMethod: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Modalidade de Envio *" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PAC">PAC</SelectItem>
              <SelectItem value="SEDEX">SEDEX</SelectItem>
              <SelectItem value="Transportadora">Transportadora</SelectItem>
              <SelectItem value="Motoboy">Motoboy</SelectItem>
              <SelectItem value="Retira">Retira no Local</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={form.desc || ''}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
            placeholder="Descrição (opcional)"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button onClick={handleAddTracking}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'reverse'} onOpenChange={() => resetDialog()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar Envio Reverso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Número da NF ou Pedido de Venda *</label>
              <Input
                value={form.reverseInvoice || ''}
                onChange={(e) => setForm({ ...form, reverseInvoice: e.target.value })}
                placeholder="Ex: NF-12345"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Nome do Item *</label>
              <Input
                value={form.reverseItemName || ''}
                onChange={(e) => setForm({ ...form, reverseItemName: e.target.value })}
                placeholder="Nome do produto"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Valor do Item (R$) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.reverseItemValue || ''}
                onChange={(e) => setForm({ ...form, reverseItemValue: e.target.value })}
                placeholder="0.00"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Data da Venda *</label>
              <Input
                type="date"
                value={form.reverseSaleDate || ''}
                onChange={(e) => setForm({ ...form, reverseSaleDate: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Motivo da Devolução *</label>
              <Select
                value={form.reverseReason || ''}
                onValueChange={(v) => setForm({ ...form, reverseReason: v })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Troca">Troca</SelectItem>
                  <SelectItem value="Arrependimento">Arrependimento</SelectItem>
                  <SelectItem value="Garantia">Garantia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.reverseReason && (
              <div>
                <label className="text-xs font-medium">
                  Imagem do Produto {form.reverseReason !== 'Arrependimento' ? '*' : '(opcional)'}
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setForm({ ...form, reverseProductImage: e.target.files?.[0] })}
                  className="h-9 text-sm"
                />
                <div
                  className={`mt-2 border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors ${form.reverseProductImage ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
                  tabIndex={0}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) {
                          setForm((prev: any) => ({ ...prev, reverseProductImage: file }));
                          toast.success('Imagem colada com sucesso!');
                        }
                        break;
                      }
                    }
                  }}
                >
                  {form.reverseProductImage ? (
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={URL.createObjectURL(form.reverseProductImage)}
                        alt="Preview"
                        className="max-h-24 rounded object-contain"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {(form.reverseProductImage as File).name || 'Imagem colada'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm((prev: any) => ({ ...prev, reverseProductImage: undefined }));
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Clique aqui e cole uma imagem com{' '}
                      <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+V</kbd>
                    </p>
                  )}
                </div>
                {form.reverseReason !== 'Arrependimento' && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Obrigatório para verificação da integridade do produto
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button onClick={handleRequestReverse}>Solicitar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'receipt'} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Notinha</DialogTitle>
          </DialogHeader>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setForm({ ...form, photo: e.target.files?.[0] })}
          />
          <Textarea
            value={form.desc || ''}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
            placeholder="Descrição (opcional)"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button onClick={handleAddReceipt}>Enviar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'quote'} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Orçamento</DialogTitle>
          </DialogHeader>
          <Input
            value={form.product || ''}
            onChange={(e) => setForm({ ...form, product: e.target.value })}
            placeholder="Nome do produto"
          />
          <div className="flex gap-2">
            <Textarea
              value={form.desc || ''}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              placeholder="Descrição (opcional)"
              rows={2}
              className="flex-1"
            />
            <Input
              type="number"
              min={1}
              value={form.qty || 1}
              onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) || 1 })}
              className="w-20"
              placeholder="Qtd"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button onClick={handleRequestQuote}>Solicitar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'lowstock'} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Produto Esgotando</DialogTitle>
          </DialogHeader>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setForm({ ...form, photo: e.target.files?.[0] })}
          />
          <Textarea
            value={form.desc || ''}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
            placeholder="Descrição / Observações"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button onClick={handleReportLowStock}>Reportar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'supply'} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Material</DialogTitle>
          </DialogHeader>
          <Input
            value={form.item || ''}
            onChange={(e) => setForm({ ...form, item: e.target.value })}
            placeholder="Nome do material"
          />
          <div className="flex gap-2">
            <Textarea
              value={form.desc || ''}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              placeholder="Descrição (opcional)"
              rows={2}
              className="flex-1"
            />
            <Input
              type="number"
              min={1}
              value={form.qty || 1}
              onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) || 1 })}
              className="w-20"
              placeholder="Qtd"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button onClick={handleRequestSupply}>Solicitar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'motoboy'} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa para Motoboy</DialogTitle>
          </DialogHeader>
          <Textarea
            value={form.desc || ''}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
            placeholder="Descrição da tarefa"
            rows={3}
          />
          <Input
            value={form.clientName || ''}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            placeholder="Nome do Cliente"
          />
          <Input
            value={form.location || ''}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Localização"
          />
          <Input
            type="text"
            inputMode="decimal"
            value={form.rideValue || ''}
            onChange={(e) =>
              setForm({ ...form, rideValue: e.target.value.replace(/[^\d,.]/g, '') })
            }
            placeholder="Valor (R$)"
          />
          {!form.scheduleEnabled && (
            <Select
              value={form.assignee || ''}
              onValueChange={(v) => setForm({ ...form, assignee: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar motoboy" />
              </SelectTrigger>
              <SelectContent>
                {motoboys.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
                {motoboys.length === 0 && (
                  <SelectItem value="none" disabled>
                    Nenhum motoboy cadastrado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label
              htmlFor="schedule-new"
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <CalendarClock className="w-4 h-4 text-destructive" />
              Agendar corrida
            </Label>
            <Switch
              id="schedule-new"
              checked={!!form.scheduleEnabled}
              onCheckedChange={(v) => setForm({ ...form, scheduleEnabled: v })}
            />
          </div>
          {form.scheduleEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={form.scheduleDate || ''}
                onChange={(e) => setForm({ ...form, scheduleDate: e.target.value })}
              />
              <Input
                type="time"
                value={form.scheduleTime || ''}
                onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })}
              />
              <p className="col-span-2 text-[11px] text-destructive">
                Corridas agendadas vão para a fila de aprovação na aba Motoboys.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog} disabled={motoboyLoading}>
              Cancelar
            </Button>
            <Button onClick={handleAssignMotoboy} disabled={motoboyLoading}>
              {motoboyLoading ? 'Criando...' : 'Atribuir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'editMotoboy'} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Corrida</DialogTitle>
          </DialogHeader>
          <Textarea
            value={form.editDesc || ''}
            onChange={(e) => setForm({ ...form, editDesc: e.target.value })}
            placeholder="Descrição"
            rows={2}
          />
          <Input
            value={form.editClient || ''}
            onChange={(e) => setForm({ ...form, editClient: e.target.value })}
            placeholder="Nome do Cliente"
          />
          <Input
            value={form.editLocation || ''}
            onChange={(e) => setForm({ ...form, editLocation: e.target.value })}
            placeholder="Localização"
          />
          <Input
            type="text"
            inputMode="decimal"
            value={form.editValue || ''}
            onChange={(e) =>
              setForm({ ...form, editValue: e.target.value.replace(/[^\d,.]/g, '') })
            }
            placeholder="Valor (R$)"
          />
          <Textarea
            value={form.editNotes || ''}
            onChange={(e) => setForm({ ...form, editNotes: e.target.value })}
            placeholder="Observações"
            rows={2}
          />
          <Select
            value={form.editAssignee || ''}
            onValueChange={(v) => setForm({ ...form, editAssignee: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Motoboy responsável" />
            </SelectTrigger>
            <SelectContent>
              {motoboys.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Data e hora da corrida</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={form.editDate || ''}
                onChange={(e) => setForm({ ...form, editDate: e.target.value })}
              />
              <Input
                type="time"
                value={form.editTime || ''}
                onChange={(e) => setForm({ ...form, editTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!form.editId) return;
                const val = parseFloat((form.editValue || '').replace(',', '.')) || 15;
                let scheduledFor: string | null | undefined = undefined;
                if (form.editDate) {
                  const timeStr = form.editTime || '12:00';
                  const dt = new Date(`${form.editDate}T${timeStr}:00`);
                  if (isNaN(dt.getTime())) {
                    toast.error('Data/hora inválida');
                    return;
                  }
                  scheduledFor = dt.toISOString();
                }
                await dept.updateMotoboyAssignment(form.editId, {
                  description: form.editDesc,
                  clientName: form.editClient,
                  location: form.editLocation,
                  rideValue: val,
                  notes: form.editNotes,
                  assignedTo: form.editAssignee,
                  scheduledFor,
                });
                toast.success('Corrida atualizada!');
                resetDialog();
              }}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Lightbox de imagem ampliada */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          {enlargedImage && (
            <img
              src={enlargedImage}
              alt="Imagem ampliada"
              className="w-full h-full max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentalPage;
