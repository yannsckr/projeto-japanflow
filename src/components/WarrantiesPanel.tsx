import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useWarranties } from '@/hooks/useWarranties';
import type { WarrantyClaim, WarrantyEditableFields } from '@/hooks/useWarranties';
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
import WarrantyEditForm from '@/components/WarrantyEditForm';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Search, X, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/lib/uploadImage';
import WarrantyAttachmentViewer from '@/components/WarrantyAttachmentViewer';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';
import { canAccessWarrantyModule, canTrashWarranty } from '@/lib/warrantyPermissions';

const WARRANTY_STATUSES = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'falta_documentacao', label: 'Falta de Documentação' },
  { value: 'encaminhada', label: 'Encaminhada' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'indeferida', label: 'Indeferida' },
  { value: 'concluida', label: 'Concluída' },
];

const getStatusLabel = (s: string) => WARRANTY_STATUSES.find((st) => st.value === s)?.label || s;
const getStatusColor = (s: string) => {
  switch (s) {
    case 'pendente':
      return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
    case 'falta_documentacao':
      return 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
    case 'encaminhada':
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
    case 'em_analise':
      return 'bg-purple-500/20 text-purple-700 dark:text-purple-400';
    case 'aprovada':
      return 'bg-green-500/20 text-green-700 dark:text-green-400';
    case 'indeferida':
      return 'bg-red-500/20 text-red-700 dark:text-red-400';
    case 'concluida':
      return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const uploadFile = async (
  file: File,
  folder: string,
  field: string,
  uploadedBy?: string | null,
  sourceId?: string | null,
  sourceTable: string = 'warranty_claims'
): Promise<string | null> => {
  try {
    const r = await uploadImage(file, {
      pathPrefix: folder,
      sourceTable,
      sourceField: field,
      sourceId: sourceId ?? null,
      uploadedBy: uploadedBy ?? null,
    });
    return r.publicUrl;
  } catch (e) {
    toast.error('Erro ao enviar arquivo');
    return null;
  }
};

// Miniatura local: cria a URL só uma vez por arquivo e a libera ao desmontar.
function LocalProductImage({ file, index }: { file: File; index: number }) {
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!previewUrl) return <div className="h-16 w-full rounded bg-muted" />;
  return (
    <img
      src={previewUrl}
      alt={`Imagem ${index + 1} do produto`}
      className="w-full h-16 object-cover rounded"
    />
  );
}

const WarrantiesPanel = () => {
  const { currentUser, users } = useApp();
  const { hasFeature } = useFeaturePermissions();
  const warrantyFeature = hasFeature(currentUser?.id, 'tracking_warranties');
  const canAccessModule = canAccessWarrantyModule(currentUser, warrantyFeature);
  const canTrashClaim = useCallback(
    (claim: Pick<WarrantyClaim, 'requestedBy' | 'origin'>) =>
      canTrashWarranty(currentUser, claim, warrantyFeature),
    [currentUser, warrantyFeature]
  );
  const {
    claims,
    updates,
    claimsError,
    updatesError,
    createClaim,
    updateClaim,
    updateClaimStatus,
    addUpdate,
    softDeleteClaim,
    restoreClaim,
  } = useWarranties();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaim | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Create form state
  const [form, setForm] = useState<any>({});
  const [laborEnabled, setLaborEnabled] = useState(false);
  const [laborFile, setLaborFile] = useState<File | null>(null);
  const [vehicleDocFile, setVehicleDocFile] = useState<File | null>(null);
  const [identityDocFile, setIdentityDocFile] = useState<File | null>(null);
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarrantyClaim | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const MAX_PRODUCT_IMAGES = 4;

  const addProductImages = (files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!incoming.length) return;
    setProductImageFiles((prev) => {
      const room = MAX_PRODUCT_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`Máximo de ${MAX_PRODUCT_IMAGES} imagens`);
        return prev;
      }
      if (incoming.length > room) toast.error(`Máximo de ${MAX_PRODUCT_IMAGES} imagens`);
      return [...prev, ...incoming.slice(0, room)];
    });
  };

  // Detail update state
  const [updateContent, setUpdateContent] = useState('');
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const getName = useCallback(
    (id: string) => (id === 'site' ? 'Site' : users.find((u) => u.id === id)?.name || id),
    [users]
  );

  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      if (c.deletedAt) return false;
      const matchSearch =
        !search ||
        [c.clientName, c.supplierName, c.itemName, getName(c.requestedBy)].some((v) =>
          (v || '').toLowerCase().includes(search.toLowerCase())
        );
      const matchDate = !filterDate || c.createdAt?.slice(0, 10) === filterDate;
      const matchStatus = filterStatus === 'all' || c.status === filterStatus;
      return matchSearch && matchDate && matchStatus;
    });
  }, [claims, search, filterDate, filterStatus, getName]);

  const trashedClaims = useMemo(
    () => claims.filter((claim) => Boolean(claim.deletedAt) && canTrashClaim(claim)),
    [claims, canTrashClaim]
  );

  const displayedClaims = showTrash ? trashedClaims : filteredClaims;

  const claimUpdates = useMemo(() => {
    if (!selectedClaim) return [];
    return updates.filter((u) => u.warrantyId === selectedClaim.id);
  }, [updates, selectedClaim]);

  if (!currentUser) return null;

  const handleSaveEdit = async (fields: WarrantyEditableFields) => {
    if (!selectedClaim || !currentUser) return;

    setSavingEdit(true);
    try {
      await updateClaim(selectedClaim.id, fields, currentUser.id);
      setSelectedClaim((previous) => (previous ? { ...previous, ...fields } : null));
      setEditing(false);
      toast.success('Garantia atualizada com sucesso');
    } catch (error) {
      console.error('[Garantias] Erro ao editar:', error);
      toast.error('Não foi possível salvar as alterações');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteClaim = async () => {
    if (!deleteTarget || !currentUser || !canTrashClaim(deleteTarget)) {
      toast.error('Você só pode excluir suas próprias garantias.');
      return;
    }

    setDeleting(true);
    try {
      const result = await softDeleteClaim(deleteTarget.id);
      toast.success('Garantia enviada para a lixeira');

      if (result.archivedTasks === 0 && deleteTarget.origin !== 'site') {
        toast.warning(
          'Nenhuma tarefa vinculada foi arquivada. ' +
            'Verifique se existe uma tarefa manual antiga no quadro.'
        );
      }

      setDeleteTarget(null);
      setSelectedClaim(null);
      setEditing(false);
    } catch (error) {
      console.error('[Garantias] Falha ao excluir:', error);
      toast.error('Não foi possível excluir a garantia');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestoreClaim = async (claim: WarrantyClaim) => {
    if (!currentUser || !canTrashClaim(claim)) {
      toast.error('Você só pode restaurar suas próprias garantias.');
      return;
    }

    setRestoringId(claim.id);
    try {
      await restoreClaim(claim.id);
      toast.success('Garantia restaurada com sucesso');
    } catch (error) {
      console.error('[Garantias] Falha ao restaurar:', error);
      toast.error('Não foi possível restaurar a garantia');
    } finally {
      setRestoringId(null);
    }
  };

  const handleCreate = async () => {
    if (
      !form.clientName?.trim() ||
      !form.productBrand?.trim() ||
      !form.itemName?.trim() ||
      !form.saleDate ||
      !form.invoiceNumber?.trim()
    ) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (laborEnabled && !laborFile) {
      toast.error('Anexe o documento de ressarcimento de mão de obra');
      return;
    }
    if (laborEnabled && !form.bankDetails?.trim()) {
      toast.error('Preencha os dados bancários para ressarcimento');
      return;
    }
    setCreating(true);
    try {
      let laborFileUrl: string | null = null;
      let vehicleDocUrl: string | null = null;
      let identityDocUrl: string | null = null;

      if (laborFile)
        laborFileUrl = await uploadFile(
          laborFile,
          'warranties/labor',
          'labor_reimbursement_file_url',
          currentUser.id
        );
      if (vehicleDocFile)
        vehicleDocUrl = await uploadFile(
          vehicleDocFile,
          'warranties/vehicle-doc',
          'vehicle_document_url',
          currentUser.id
        );
      if (identityDocFile)
        identityDocUrl = await uploadFile(
          identityDocFile,
          'warranties/identity-doc',
          'identity_document_url',
          currentUser.id
        );

      if (laborFile && !laborFileUrl) throw new Error('Falha no anexo de ressarcimento');
      if (vehicleDocFile && !vehicleDocUrl) throw new Error('Falha no documento do veículo');
      if (identityDocFile && !identityDocUrl) throw new Error('Falha no documento de identidade');

      const productImageUrls: string[] = [];
      for (const f of productImageFiles.slice(0, MAX_PRODUCT_IMAGES)) {
        const url = await uploadFile(f, 'warranties/product', 'product_images', currentUser.id);
        if (!url)
          throw new Error(`Não foi possível enviar a imagem ${productImageUrls.length + 1}`);
        productImageUrls.push(url);
      }

      await createClaim({
        clientName: form.clientName.trim(),
        supplierName: form.supplierName?.trim() || '',
        productBrand: form.productBrand.trim(),
        itemName: form.itemName.trim(),
        itemCode: form.itemCode?.trim() || '',
        defectDescription: form.defectDescription?.trim() || '',
        saleDate: form.saleDate,
        invoiceNumber: form.invoiceNumber.trim(),
        requestedBy: currentUser.id,
        laborReimbursementEnabled: laborEnabled,
        laborReimbursementFileUrl: laborFileUrl,
        bankDetails: laborEnabled ? form.bankDetails?.trim() || null : null,
        vehicleDocumentUrl: vehicleDocUrl,
        identityDocumentUrl: identityDocUrl,
        installationMileage: form.installationMileage?.trim() || null,
        currentMileage: form.currentMileage?.trim() || null,
        productImages: productImageUrls,
      });
      // A tarefa é criada na mesma operação atômica da garantia pelo useWarranties.
      toast.success('Pedido de garantia criado');
      setShowCreate(false);
      setForm({});
      setLaborEnabled(false);
      setLaborFile(null);
      setVehicleDocFile(null);
      setIdentityDocFile(null);
      setProductImageFiles([]);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar pedido');
    } finally {
      setCreating(false);
    }
  };

  const handlePostUpdate = async () => {
    if (!selectedClaim) return;
    if (!updateContent.trim() && !updateFile) {
      toast.error('Adicione um comentário ou anexo');
      return;
    }
    setPosting(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (updateFile) {
        fileUrl = await uploadFile(
          updateFile,
          'warranties/updates',
          'file_url',
          currentUser.id,
          selectedClaim.id,
          'warranty_updates'
        );
        if (!fileUrl) throw new Error('Falha ao enviar o anexo da atualização');
        fileName = updateFile.name;
      }
      await addUpdate(selectedClaim.id, currentUser.id, updateContent.trim(), fileUrl, fileName);
      setUpdateContent('');
      setUpdateFile(null);
      toast.success('Atualização adicionada');
    } catch {
      toast.error('Erro ao adicionar atualização');
    } finally {
      setPosting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedClaim || savingStatus) return;
    setSavingStatus(true);
    try {
      await updateClaimStatus(selectedClaim.id, newStatus, currentUser.id);
      setSelectedClaim((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast.success('Status atualizado');
    } catch (error) {
      console.error('[Garantias] Erro ao mudar status:', error);
      toast.error('Não foi possível atualizar o status');
    } finally {
      setSavingStatus(false);
    }
  };

  const acceptedFileTypes = '.pdf,.jpeg,.jpg,.png';

  return (
    <div className="space-y-3">
      {claimsError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          {claimsError}
        </p>
      )}
      {updatesError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          {updatesError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-3 h-3 mr-1" />
          Novo Pedido de Garantia
        </Button>
        {canAccessModule && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowTrash((value) => !value);
              setSelectedClaim(null);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {showTrash ? 'Voltar às garantias' : `Lixeira (${trashedClaims.length})`}
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, fornecedor, item ou solicitante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="h-9 text-sm w-full sm:w-40"
        />
        {filterDate && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDate('')} className="h-9">
            <X className="h-4 w-4" />
          </Button>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {WARRANTY_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showTrash && (
        <p className="text-xs text-muted-foreground">
          Garantias excluídas podem ser restauradas sem perder documentos ou histórico.
        </p>
      )}

      {/* Lista */}
      {!claimsError && displayedClaims.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {showTrash ? 'A lixeira está vazia' : 'Nenhum pedido de garantia encontrado'}
        </p>
      ) : claimsError ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {displayedClaims.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                if (!showTrash) {
                  setEditing(false);
                  setSelectedClaim(c);
                }
              }}
              onKeyDown={(event) => {
                if (!showTrash && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  setEditing(false);
                  setSelectedClaim(c);
                }
              }}
              role={showTrash ? undefined : 'button'}
              tabIndex={showTrash ? undefined : 0}
              className={cn(
                'bg-card border border-border rounded-lg p-3 transition-colors',
                showTrash
                  ? 'cursor-default'
                  : 'cursor-pointer hover:bg-secondary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{c.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    Solicitante: {getName(c.requestedBy)}
                  </p>
                  <p className="text-xs text-muted-foreground">Fornecedor: {c.supplierName}</p>
                  <p className="text-xs text-muted-foreground">Item: {c.itemName}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}
                  </p>
                  {showTrash && c.deletedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Excluída: {new Date(c.deletedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap',
                    getStatusColor(c.status)
                  )}
                >
                  {getStatusLabel(c.status)}
                </span>
              </div>

              {showTrash && canTrashClaim(c) && (
                <div className="mt-3 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoringId === c.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRestoreClaim(c);
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {restoringId === c.id ? 'Restaurando...' : 'Restaurar garantia'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog Criar */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pedido de Garantia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Cliente *</Label>
              <Input
                value={form.clientName || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, clientName: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nome do Fornecedor</Label>
              <Input
                value={form.supplierName || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, supplierName: e.target.value }))}
                placeholder="Opcional - será preenchido pelo setor de garantias"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Marca do Produto *</Label>
              <Input
                value={form.productBrand || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, productBrand: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nome do Item *</Label>
              <Input
                value={form.itemName || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, itemName: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Código do Item</Label>
              <Input
                value={form.itemCode || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, itemCode: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição do Defeito *</Label>
              <Textarea
                value={form.defectDescription || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, defectDescription: e.target.value }))}
                className="text-sm"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs">Data da Venda *</Label>
              <Input
                type="date"
                value={form.saleDate || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, saleDate: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nº da Nota / Pedido de Venda *</Label>
              <Input
                value={form.invoiceNumber || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, invoiceNumber: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            {/* Imagens do produto */}
            <div>
              <Label className="text-xs">
                Imagens do Produto ({productImageFiles.length}/{MAX_PRODUCT_IMAGES})
              </Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                disabled={productImageFiles.length >= MAX_PRODUCT_IMAGES}
                onChange={(e) => {
                  addProductImages(e.target.files);
                  e.target.value = '';
                }}
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Até {MAX_PRODUCT_IMAGES} imagens. Você também pode colar (Ctrl+V) aqui.
              </p>
              <div
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files || []);
                  if (files.length) {
                    e.preventDefault();
                    addProductImages(files);
                  }
                }}
                tabIndex={0}
                className="mt-2 rounded-md border border-dashed border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {productImageFiles.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    Clique aqui e cole uma imagem
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {productImageFiles.map((f, i) => (
                      <div key={i} className="relative">
                        <LocalProductImage file={f} index={i} />
                        <button
                          type="button"
                          onClick={() =>
                            setProductImageFiles((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ressarcimento */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Switch checked={laborEnabled} onCheckedChange={setLaborEnabled} />
              <Label className="text-xs">Ressarcimento de Mão de Obra</Label>
            </div>
            {laborEnabled && (
              <div className="space-y-2 pl-2 border-l-2 border-primary/30">
                <div>
                  <Label className="text-xs">
                    Nota Fiscal de Ressarcimento (PDF, JPEG, JPG ou PNG) *
                  </Label>
                  <Input
                    type="file"
                    accept={acceptedFileTypes}
                    onChange={(e) => setLaborFile(e.target.files?.[0] || null)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Dados Bancários para Ressarcimento *</Label>
                  <Textarea
                    value={form.bankDetails || ''}
                    onChange={(e) => setForm((p: any) => ({ ...p, bankDetails: e.target.value }))}
                    className="text-sm"
                    rows={2}
                    placeholder="Banco, Agência, Conta, PIX..."
                  />
                </div>
              </div>
            )}

            {/* Opcionais */}
            <p className="text-xs font-medium text-muted-foreground pt-2 border-t border-border">
              Campos Opcionais
            </p>
            <div>
              <Label className="text-xs">Documento do Veículo</Label>
              <Input
                type="file"
                accept={acceptedFileTypes}
                onChange={(e) => setVehicleDocFile(e.target.files?.[0] || null)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Documento de Identidade</Label>
              <Input
                type="file"
                accept={acceptedFileTypes}
                onChange={(e) => setIdentityDocFile(e.target.files?.[0] || null)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Quilometragem na Instalação</Label>
              <Input
                value={form.installationMileage || ''}
                onChange={(e) =>
                  setForm((p: any) => ({ ...p, installationMileage: e.target.value }))
                }
                className="h-9 text-sm"
                placeholder="Ex: 45.000 km"
              />
            </div>
            <div>
              <Label className="text-xs">Quilometragem Atual</Label>
              <Input
                value={form.currentMileage || ''}
                onChange={(e) => setForm((p: any) => ({ ...p, currentMileage: e.target.value }))}
                className="h-9 text-sm"
                placeholder="Ex: 52.000 km"
              />
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? 'Criando...' : 'Criar Pedido de Garantia'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes */}
      <Dialog
        open={!!selectedClaim}
        onOpenChange={(open) => {
          if (!open && !savingEdit) {
            setEditing(false);
            setSelectedClaim(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClaim && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <DialogTitle>{editing ? 'Editar Garantia' : 'Detalhes da Garantia'}</DialogTitle>
                  {!editing && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        Editar
                      </Button>
                      {canTrashClaim(selectedClaim) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(selectedClaim);
                            setSelectedClaim(null);
                            setEditing(false);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </DialogHeader>

              {editing ? (
                <WarrantyEditForm
                  key={selectedClaim.id}
                  claim={selectedClaim}
                  saving={savingEdit}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <div className="space-y-4">
                  {/* Info */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Cliente</span>
                      <p className="font-medium">{selectedClaim.clientName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Fornecedor</span>
                      <p className="font-medium">{selectedClaim.supplierName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Marca</span>
                      <p>{selectedClaim.productBrand}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Item</span>
                      <p>{selectedClaim.itemName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Código</span>
                      <p>{selectedClaim.itemCode || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Data da Venda</span>
                      <p>
                        {selectedClaim.saleDate
                          ? new Date(selectedClaim.saleDate + 'T12:00:00').toLocaleDateString(
                              'pt-BR'
                            )
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Nº Nota/Pedido</span>
                      <p>{selectedClaim.invoiceNumber || selectedClaim.siteOrder || '-'}</p>
                    </div>

                    {selectedClaim.origin === 'site' &&
                      (
                        [
                          ['Protocolo', selectedClaim.siteProtocol || ''],
                          [
                            'Pedido informado no site',
                            selectedClaim.siteOrder &&
                            selectedClaim.siteOrder !== selectedClaim.invoiceNumber
                              ? selectedClaim.siteOrder
                              : '',
                          ],
                          ['Canal de contato', selectedClaim.siteContactChannel || ''],
                          ['Contato', selectedClaim.siteContact || ''],
                          [
                            'Recebimento da peça',
                            selectedClaim.siteReceived
                              ? selectedClaim.siteReceived.split('-').reverse().join('/')
                              : '',
                          ],
                          ['Peça instalada?', selectedClaim.siteInstalled || ''],
                          ['Veículo', selectedClaim.siteVehicle || ''],
                          ['Observações', selectedClaim.siteNotes || ''],
                        ] as [string, string][]
                      )
                        .filter(([, value]) => Boolean(value))
                        .map(([label, value]) => (
                          <div
                            key={label}
                            className={label === 'Observações' ? 'col-span-2 min-w-0' : 'min-w-0'}
                          >
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <p className="whitespace-pre-wrap break-words">{value}</p>
                          </div>
                        ))}

                    <div>
                      <span className="text-xs text-muted-foreground">Solicitante</span>
                      <p>{getName(selectedClaim.requestedBy)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Defeito</span>
                      <p>{selectedClaim.defectDescription || '-'}</p>
                    </div>
                    {selectedClaim.installationMileage && (
                      <div>
                        <span className="text-xs text-muted-foreground">Km Instalação</span>
                        <p>{selectedClaim.installationMileage}</p>
                      </div>
                    )}
                    {selectedClaim.currentMileage && (
                      <div>
                        <span className="text-xs text-muted-foreground">Km Atual</span>
                        <p>{selectedClaim.currentMileage}</p>
                      </div>
                    )}
                  </div>

                  {/* Documentos e anexos */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Documentos e anexos</p>

                    {selectedClaim.productImages?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Imagens do produto</p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {selectedClaim.productImages.map((url, i) => (
                            <WarrantyAttachmentViewer
                              key={url + i}
                              source={url}
                              name={`Imagem do produto ${i + 1}`}
                              variant="thumbnail"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedClaim.siteAttachments?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Anexos recebidos pelo site</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedClaim.siteAttachments.map((file) => (
                            <WarrantyAttachmentViewer
                              key={file.path}
                              source={file.path}
                              name={file.name}
                              mimeType={file.type}
                              variant={file.type.startsWith('image/') ? 'thumbnail' : 'row'}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {selectedClaim.laborReimbursementEnabled &&
                        selectedClaim.laborReimbursementFileUrl && (
                          <WarrantyAttachmentViewer
                            source={selectedClaim.laborReimbursementFileUrl}
                            name="NF Ressarcimento"
                          />
                        )}

                      {selectedClaim.vehicleDocumentUrl && (
                        <WarrantyAttachmentViewer
                          source={selectedClaim.vehicleDocumentUrl}
                          name="Documento do veículo"
                        />
                      )}

                      {selectedClaim.identityDocumentUrl && (
                        <WarrantyAttachmentViewer
                          source={selectedClaim.identityDocumentUrl}
                          name="Documento de identidade"
                        />
                      )}
                    </div>

                    {selectedClaim.laborReimbursementEnabled && selectedClaim.bankDetails && (
                      <div>
                        <span className="text-xs text-muted-foreground">Dados Bancários:</span>
                        <p className="text-sm">{selectedClaim.bankDetails}</p>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Status:</Label>
                    <Select
                      value={selectedClaim.status}
                      onValueChange={handleStatusChange}
                      disabled={savingStatus}
                    >
                      <SelectTrigger className="h-8 w-48 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WARRANTY_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Atualizações */}
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-medium mb-2">Atualizações ({claimUpdates.length})</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {claimUpdates.map((u) => (
                        <div key={u.id} className="bg-secondary/30 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">{getName(u.userId)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(u.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          {u.content && <p className="text-sm mt-1">{u.content}</p>}
                          {u.attachmentUrl && (
                            <WarrantyAttachmentViewer
                              source={u.attachmentUrl}
                              name={u.attachmentName || 'Anexo da atualização'}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Nova Atualização */}
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Adicionar atualização..."
                        value={updateContent}
                        onChange={(e) => setUpdateContent(e.target.value)}
                        className="text-sm"
                        rows={2}
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept={acceptedFileTypes}
                          onChange={(e) => setUpdateFile(e.target.files?.[0] || null)}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handlePostUpdate}
                          disabled={posting}
                          className="h-8"
                        >
                          {posting ? '...' : 'Enviar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title="Excluir pedido de garantia?"
        description={
          <>
            A garantia de <strong>{deleteTarget?.clientName || 'este cliente'}</strong> será enviada
            para a lixeira.
            <p className="mt-2">
              Os documentos, os anexos e o histórico serão preservados. A tarefa vinculada será
              arquivada quando houver identificação segura.
            </p>
            <p className="mt-2">Você poderá restaurar esta garantia depois.</p>
          </>
        }
        confirmLabel="Excluir garantia"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={handleDeleteClaim}
      />
    </div>
  );
};

export default WarrantiesPanel;
