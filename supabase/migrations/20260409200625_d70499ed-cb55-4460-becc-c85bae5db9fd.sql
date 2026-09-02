
CREATE TABLE public.warranty_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name text NOT NULL,
  supplier_name text NOT NULL DEFAULT '',
  product_brand text NOT NULL,
  item_name text NOT NULL,
  item_code text NOT NULL DEFAULT '',
  defect_description text NOT NULL DEFAULT '',
  sale_date text NOT NULL,
  invoice_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  requested_by text NOT NULL,
  labor_reimbursement_enabled boolean NOT NULL DEFAULT false,
  labor_reimbursement_file_url text,
  bank_details text,
  vehicle_document_url text,
  identity_document_url text,
  installation_mileage text,
  current_mileage text,
  last_7day_reminder_at timestamp with time zone,
  last_26day_notified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select warranty_claims" ON public.warranty_claims FOR SELECT USING (true);
CREATE POLICY "Allow all insert warranty_claims" ON public.warranty_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update warranty_claims" ON public.warranty_claims FOR UPDATE USING (true);
CREATE POLICY "Allow all delete warranty_claims" ON public.warranty_claims FOR DELETE USING (true);

CREATE TABLE public.warranty_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warranty_id uuid NOT NULL REFERENCES public.warranty_claims(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  content text NOT NULL DEFAULT '',
  attachment_url text,
  attachment_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.warranty_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select warranty_updates" ON public.warranty_updates FOR SELECT USING (true);
CREATE POLICY "Allow all insert warranty_updates" ON public.warranty_updates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update warranty_updates" ON public.warranty_updates FOR UPDATE USING (true);
CREATE POLICY "Allow all delete warranty_updates" ON public.warranty_updates FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.warranty_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warranty_updates;
