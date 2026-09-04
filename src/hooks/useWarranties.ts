import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
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
  createdAt: string;
  updatedAt: string;
}

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
  status: data.status || 'pending',
  requestedBy: data.requested_by || '',
  laborReimbursementEnabled: data.labor_reimbursement_enabled === true,
  laborReimbursementFileUrl: data.labor_reimbursement_file_url || null,
  bankDetails: data.bank_details || null,
  vehicleDocumentUrl: data.vehicle_document_url || null,
  identityDocumentUrl: data.identity_document_url || null,
  installationMileage: data.installation_mileage || null,
  currentMileage: data.current_mileage || null,
  productImages: Array.isArray(data.product_images) ? data.product_images : [],
  createdAt: toIso(data.created_at),
  updatedAt: toIso(data.updated_at),
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

export const useWarranties = () => {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [updates, setUpdates] = useState<WarrantyUpdate[]>([]);

  useEffect(() => {
    const unsubscribeClaims = onSnapshot(
      query(collection(db, 'warranty_claims'), orderBy('created_at', 'desc')),
      (snapshot) => {
        setClaims(snapshot.docs.map((claimDoc) => mapClaim(claimDoc.id, claimDoc.data())));
      },
      (error) => console.error('Erro ao carregar garantias:', error)
    );

    const unsubscribeUpdates = onSnapshot(
      query(collection(db, 'warranty_updates'), orderBy('created_at', 'asc')),
      (snapshot) => {
        setUpdates(snapshot.docs.map((updateDoc) => mapUpdate(updateDoc.id, updateDoc.data())));
      },
      (error) => console.error('Erro ao carregar atualizações de garantia:', error)
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
    }) => {
      await addDoc(collection(db, 'warranty_claims'), {
        client_name: data.clientName,
        supplier_name: data.supplierName,
        product_brand: data.productBrand,
        item_name: data.itemName,
        item_code: data.itemCode,
        defect_description: data.defectDescription,
        sale_date: data.saleDate,
        invoice_number: data.invoiceNumber,
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
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const updateClaimStatus = useCallback(async (id: string, status: string) => {
    await updateDoc(doc(db, 'warranty_claims', id), {
      status,
      updated_at: Timestamp.now(),
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
      await addDoc(collection(db, 'warranty_updates'), {
        warranty_id: warrantyId,
        user_id: userId,
        content,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
        created_at: Timestamp.now(),
      });
    },
    []
  );

  return {
    claims,
    updates,
    createClaim,
    updateClaimStatus,
    addUpdate,
    fetchUpdates,
  };
};
