
ALTER TABLE public.reverse_shipments
  ADD COLUMN IF NOT EXISTS invoice_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS item_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS item_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_date text,
  ADD COLUMN IF NOT EXISTS return_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_image_url text;
