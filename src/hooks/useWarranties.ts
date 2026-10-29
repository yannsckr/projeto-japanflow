import { useState, useEffect, useCallback } from 'react';
import app, { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';

export interface WarrantyClaim {
  id: string;
  clientName: string;
  supplierName: string;
  productBrand: string;
  itemName: string;
  itemCode: string;
  defectDescription: string;
  saleDate: string;
  invoiceNumber: string;
  status: string;
  requestedBy: string;
  laborReimbursementEnabled: boolean;
  laborReimbursementFileUrl: string | null;
  bankDetails: string | null;
  vehicleDocumentUrl: string | null;
  identityDocumentUrl: string | null;
  installationMileage: string | null;
  currentMileage: string | null;
  productImages: string[];
  origin?: string;
  siteProtocol?: string;
  siteOrder?: string;
  siteContactChannel?: string;
  siteContact?: string;
  siteReceived?: string;
  siteInstalled?: string;
  siteVehicle?: string;
  siteNotes?: string;
  siteAttachments?: { path: string; name: string; type: string; size: number; sha256: string }[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export type WarrantyEditableFields = Pick<
  WarrantyClaim,
  | 'clientName'
  | 'supplierName'
  | 'productBrand'
  | 'itemName'
  | 'itemCode'
  | 'defectDescription'
  | 'saleDate'
  | 'invoiceNumber'
  | 'installationMileage'
  | 'currentMileage'
  | 'siteOrder'
  | 'siteContactChannel'
  | 'siteContact'
  | 'siteReceived'
  | 'siteInstalled'
  | 'siteVehicle'
  | 'siteNotes'
>;

export interface WarrantyUpdate {
  id: string;
  warrantyId: string;
  userId: string;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

const mapClaim = (id: string, data: any): WarrantyClaim => ({
  id,
  clientName: data.client_name || '',
  supplierName: data.supplier_name || '',
  productBrand: data.product_brand || '',
  itemName: data.item_name || '',
  itemCode: data.item_code || '',
  defectDescription: data.defect_description || '',
  saleDate: data.sale_date || '',
  invoiceNumber: data.invoice_number || '',
  status: data.status === 'pending' ? 'pendente' : data.status || 'pendente',
  requestedBy: data.requested_by || '',
  laborReimbursementEnabled: data.labor_reimbursement_enabled === true,
  laborReimbursementFileUrl: data.labor_reimbursement_file_url || null,
  bankDetails: data.bank_details || null,
  vehicleDocumentUrl: data.vehicle_document_url || null,
  identityDocumentUrl: data.identity_document_url || null,
  installationMileage: data.installation_mileage || null,
  currentMileage: data.current_mileage || null,
  productImages: Array.isArray(data.product_images) ? data.product_images : [],
  origin: data.origin || '',
  siteProtocol: data.site_protocol || '',
  siteOrder: data.site_order || '',
  siteContactChannel: data.site_contact_channel || '',
  siteContact: data.site_contact || '',
  siteReceived: data.site_received || '',
  siteInstalled: data.site_installed || '',
  siteVehicle: data.site_vehicle || '',
  siteNotes: data.site_notes || '',
  siteAttachments: Array.isArray(data.site_attachments) ? data.site_attachments : [],
  createdAt: toIso(data.created_at),
  updatedAt: toIso(data.updated_at),
  deletedAt: toIso(data.deleted_at),
  deletedBy: data.deleted_by || '',
});

const mapUpdate = (id: string, data: any): WarrantyUpdate => ({
  id,
  warrantyId: data.warranty_id || '',
  userId: data.user_id || '',
  content: data.content || '',
  attachmentUrl: data.attachment_url || null,
  attachmentName: data.attachment_name || null,
  createdAt: toIso(data.created_at),
});

const WARRANTY_STATUSES_ALLOWED = new Set([
  'pendente',
  'falta_documentacao',
  'encaminhada',
  'em_analise',
  'aprovada',
  'indeferida',
  'concluida',
]);

export const useWarranties = () => {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [updates, setUpdates] = useState<WarrantyUpdate[]>([]);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [updatesError, setUpdatesError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeClaims = onSnapshot(
      query(collection(db, 'warranty_claims'), orderBy('created_at', 'desc')),
      (snapshot) => {
        setClaims(snapshot.docs.map((claimDoc) => mapClaim(claimDoc.id, claimDoc.data())));
        setClaimsError(null);
      },
      (error) => {
        console.error('Erro ao carregar garantias:', error);
        setClaimsError(
          error.code === 'permission-denied'
            ? 'Permissão insuficiente para consultar garantias.'
            : 'Falha ao consultar garantias. Tente atualizar a página.'
        );
      }
    );

    const unsubscribeUpdates = onSnapshot(
      query(collection(db, 'warranty_updates'), orderBy('created_at', 'asc')),
      (snapshot) => {
        setUpdates(snapshot.docs.map((updateDoc) => mapUpdate(updateDoc.id, updateDoc.data())));
        setUpdatesError(null);
      },
      (error) => {
        console.error('Erro ao carregar atualizações de garantia:', error);
        setUpdatesError(
          error.code === 'permission-denied'
            ? 'Permissão insuficiente para consultar o histórico de garantias.'
            : 'Falha ao consultar o histórico de garantias. Tente atualizar a página.'
        );
      }
    );

    return () => {
      unsubscribeClaims();
      unsubscribeUpdates();
    };
  }, []);

  const fetchUpdates = useCallback(async (_warrantyId?: string) => {
    // Mantido por compatibilidade. O listener acima já mantém os updates em tempo real.
    return;
  }, []);

  // Cadastro manual: a garantia e a tarefa são criadas na mesma gravação atômica.
  // Assim não existe garantia criada sem tarefa quando a segunda escrita falha.
  const createClaim = useCallback(
    async (data: {
      clientName: string;
      supplierName: string;
      productBrand: string;
      itemName: string;
      itemCode: string;
      defectDescription: string;
      saleDate: string;
      invoiceNumber: string;
      requestedBy: string;
      laborReimbursementEnabled: boolean;
      laborReimbursementFileUrl?: string | null;
      bankDetails?: string | null;
      vehicleDocumentUrl?: string | null;
      identityDocumentUrl?: string | null;
      installationMileage?: string | null;
      currentMileage?: string | null;
      productImages?: string[];
    }): Promise<string> => {
      if (!data.requestedBy || !data.clientName.trim() || !data.itemName.trim()) {
        throw new Error('Cliente, item e solicitante são obrigatórios');
      }

      const claimRef = doc(collection(db, 'warranty_claims'));
      const taskRef = doc(collection(db, 'tasks'));
      const batch = writeBatch(db);
      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();
      const deadline = new Date();
      deadline.setHours(23, 59, 59, 999);

      batch.set(claimRef, {
        client_name: data.clientName.trim(),
        supplier_name: data.supplierName.trim(),
        product_brand: data.productBrand.trim(),
        item_name: data.itemName.trim(),
        item_code: data.itemCode.trim(),
        defect_description: data.defectDescription.trim(),
        sale_date: data.saleDate,
        invoice_number: data.invoiceNumber.trim(),
        requested_by: data.requestedBy,
        status: 'pending',
        labor_reimbursement_enabled: data.laborReimbursementEnabled,
        labor_reimbursement_file_url: data.laborReimbursementFileUrl || null,
        bank_details: data.bankDetails || null,
        vehicle_document_url: data.vehicleDocumentUrl || null,
        identity_document_url: data.identityDocumentUrl || null,
        installation_mileage: data.installationMileage || null,
        current_mileage: data.currentMileage || null,
        product_images: data.productImages || [],
        created_at: now,
        updated_at: now,
      });

      batch.set(taskRef, {
        board_visible: true,
        warranty_id: claimRef.id,
        title: `🛡️ Garantia: ${data.clientName.trim()} - ${data.itemName.trim()}`,
        description: `Novo pedido de garantia\nCliente: ${data.clientName.trim()}\nMarca: ${data.productBrand.trim()}\nItem: ${data.itemName.trim()}\nNF/Pedido: ${data.invoiceNumber.trim()}`,
        status: 'todo',
        priority: 'high',
        assignee_id: 'emp-12',
        created_by: data.requestedBy,
        deadline: deadline.toISOString().split('T')[0],
        sector: 'garantias',
        status_history: [{ status: 'todo', enteredAt: nowIso }],
        created_at: now,
        updated_at: now,
      });

      await batch.commit();
      return claimRef.id;
    },
    []
  );

  const updateClaim = useCallback(
    async (id: string, data: WarrantyEditableFields, editedBy: string) => {
      if (!id || !editedBy || !data.clientName.trim() || !data.itemName.trim()) {
        throw new Error('Cliente, item e usuário são obrigatórios');
      }

      const claimRef = doc(db, 'warranty_claims', id);
      const historyRef = doc(collection(db, 'warranty_updates'));
      await runTransaction(db, async (tx) => {
        const claim = await tx.get(claimRef);
        if (!claim.exists() || claim.data().deleted_at) {
          throw new Error('Garantia não encontrada ou excluída');
        }

        const changes: Record<string, unknown> = {
          client_name: data.clientName.trim(),
          supplier_name: data.supplierName.trim(),
          product_brand: data.productBrand.trim(),
          item_name: data.itemName.trim(),
          item_code: data.itemCode.trim(),
          defect_description: data.defectDescription.trim(),
          sale_date: data.saleDate,
          invoice_number: data.invoiceNumber.trim(),
          installation_mileage: data.installationMileage?.trim() || null,
          current_mileage: data.currentMileage?.trim() || null,
          updated_at: Timestamp.now(),
        };

        // Não cria campos de origem "site" em garantias manuais.
        if (claim.data().origin === 'site') {
          Object.assign(changes, {
            site_order: data.siteOrder?.trim() || '',
            site_contact_channel: data.siteContactChannel?.trim() || '',
            site_contact: data.siteContact?.trim() || '',
            site_received: data.siteReceived || '',
            site_installed: data.siteInstalled?.trim() || '',
            site_vehicle: data.siteVehicle?.trim() || '',
            site_notes: data.siteNotes?.trim() || '',
          });
        }

        tx.update(claimRef, changes);
        tx.set(historyRef, {
          warranty_id: id,
          user_id: editedBy,
          content: 'Ficha da garantia editada.',
          attachment_url: null,
          attachment_name: null,
          created_at: Timestamp.now(),
        });
      });
    },
    []
  );

  // Exclusão e restauração só pelo backend autenticado. Nunca confiar em actorId do cliente.
  const softDeleteClaim = useCallback(async (id: string): Promise<{ archivedTasks: number }> => {
    const operation = httpsCallable<
      { warrantyId: string; action: 'delete' | 'restore' },
      { archivedTasks: number }
    >(getFunctions(app, 'southamerica-east1'), 'manageWarrantyLifecycle');
    const result = await operation({ warrantyId: id, action: 'delete' });
    return result.data;
  }, []);

  const restoreClaim = useCallback(async (id: string): Promise<{ restoredTasks: number }> => {
    const operation = httpsCallable<
      { warrantyId: string; action: 'delete' | 'restore' },
      { restoredTasks: number }
    >(getFunctions(app, 'southamerica-east1'), 'manageWarrantyLifecycle');
    const result = await operation({ warrantyId: id, action: 'restore' });
    return result.data;
  }, []);

  const updateClaimStatus = useCallback(async (id: string, status: string, userId?: string) => {
    if (!WARRANTY_STATUSES_ALLOWED.has(status)) {
      throw new Error('Status de garantia inválido');
    }
    const claimRef = doc(db, 'warranty_claims', id);
    const historyRef = doc(collection(db, 'warranty_updates'));
    await runTransaction(db, async (tx) => {
      const claim = await tx.get(claimRef);
      if (!claim.exists() || claim.data().deleted_at) {
        throw new Error('Garantia não encontrada ou excluída');
      }
      tx.update(claimRef, { status, updated_at: Timestamp.now() });
      if (userId) {
        tx.set(historyRef, {
          warranty_id: id,
          user_id: userId,
          content: `Status alterado para ${status}.`,
          attachment_url: null,
          attachment_name: null,
          created_at: Timestamp.now(),
        });
      }
    });
  }, []);

  const addUpdate = useCallback(
    async (
      warrantyId: string,
      userId: string,
      content: string,
      attachmentUrl?: string | null,
      attachmentName?: string | null
    ) => {
      const claimRef = doc(db, 'warranty_claims', warrantyId);
      const updateRef = doc(collection(db, 'warranty_updates'));
      await runTransaction(db, async (tx) => {
        const claim = await tx.get(claimRef);
        if (!claim.exists() || claim.data().deleted_at) {
          throw new Error('Garantia não encontrada ou excluída');
        }
        tx.set(updateRef, {
          warranty_id: warrantyId,
          user_id: userId,
          content,
          attachment_url: attachmentUrl || null,
          attachment_name: attachmentName || null,
          created_at: Timestamp.now(),
        });
      });
    },
    []
  );

  return {
    claims,
    updates,
    claimsError,
    updatesError,
    createClaim,
    updateClaim,
    updateClaimStatus,
    addUpdate,
    fetchUpdates,
    softDeleteClaim,
    restoreClaim,
  };
};
