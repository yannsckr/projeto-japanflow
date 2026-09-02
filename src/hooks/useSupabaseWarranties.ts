import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

const mapClaim = (r: any): WarrantyClaim => ({
  id: r.id,
  clientName: r.client_name,
  supplierName: r.supplier_name || '',
  productBrand: r.product_brand,
  itemName: r.item_name,
  itemCode: r.item_code || '',
  defectDescription: r.defect_description || '',
  saleDate: r.sale_date,
  invoiceNumber: r.invoice_number || '',
  status: r.status,
  requestedBy: r.requested_by,
  laborReimbursementEnabled: r.labor_reimbursement_enabled || false,
  laborReimbursementFileUrl: r.labor_reimbursement_file_url,
  bankDetails: r.bank_details,
  vehicleDocumentUrl: r.vehicle_document_url,
  identityDocumentUrl: r.identity_document_url,
  installationMileage: r.installation_mileage,
  currentMileage: r.current_mileage,
  productImages: Array.isArray(r.product_images) ? (r.product_images as string[]) : [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapUpdate = (r: any): WarrantyUpdate => ({
  id: r.id,
  warrantyId: r.warranty_id,
  userId: r.user_id,
  content: r.content || '',
  attachmentUrl: r.attachment_url,
  attachmentName: r.attachment_name,
  createdAt: r.created_at,
});

export const useSupabaseWarranties = () => {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [updates, setUpdates] = useState<WarrantyUpdate[]>([]);

  const fetchClaims = useCallback(async () => {
    const { data } = await supabase
      .from('warranty_claims')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setClaims(data.map(mapClaim));
  }, []);

  const fetchUpdates = useCallback(async (warrantyId?: string) => {
    let q = supabase.from('warranty_updates').select('*').order('created_at', { ascending: true });
    if (warrantyId) q = q.eq('warranty_id', warrantyId);
    const { data } = await q;
    if (data)
      setUpdates((prev) => {
        if (warrantyId) {
          const others = prev.filter((u) => u.warrantyId !== warrantyId);
          return [...others, ...data.map(mapUpdate)];
        }
        return data.map(mapUpdate);
      });
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchUpdates();
    const ch1 = supabase
      .channel('warranty_claims-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranty_claims' }, () =>
        fetchClaims()
      )
      .subscribe();
    const ch2 = supabase
      .channel('warranty_updates-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranty_updates' }, () =>
        fetchUpdates()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [fetchClaims, fetchUpdates]);

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
      const { error } = await supabase.from('warranty_claims').insert({
        client_name: data.clientName,
        supplier_name: data.supplierName,
        product_brand: data.productBrand,
        item_name: data.itemName,
        item_code: data.itemCode,
        defect_description: data.defectDescription,
        sale_date: data.saleDate,
        invoice_number: data.invoiceNumber,
        requested_by: data.requestedBy,
        labor_reimbursement_enabled: data.laborReimbursementEnabled,
        labor_reimbursement_file_url: data.laborReimbursementFileUrl || null,
        bank_details: data.bankDetails || null,
        vehicle_document_url: data.vehicleDocumentUrl || null,
        identity_document_url: data.identityDocumentUrl || null,
        installation_mileage: data.installationMileage || null,
        current_mileage: data.currentMileage || null,
        product_images: data.productImages || [],
      });
      if (error) throw error;
    },
    []
  );

  const updateClaimStatus = useCallback(async (id: string, status: string) => {
    await supabase
      .from('warranty_claims')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

  const addUpdate = useCallback(
    async (
      warrantyId: string,
      userId: string,
      content: string,
      attachmentUrl?: string | null,
      attachmentName?: string | null
    ) => {
      await supabase.from('warranty_updates').insert({
        warranty_id: warrantyId,
        user_id: userId,
        content,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
      });
    },
    []
  );

  return { claims, updates, createClaim, updateClaimStatus, addUpdate, fetchUpdates };
};
