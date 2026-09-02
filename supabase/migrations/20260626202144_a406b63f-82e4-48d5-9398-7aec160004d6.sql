
CREATE TABLE IF NOT EXISTS public.image_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storage_path TEXT NOT NULL,
  thumb_path TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  image_text TEXT,
  source_table TEXT,
  source_id TEXT,
  source_field TEXT,
  uploaded_by TEXT,
  preserve BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  processed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_assets_expires_at ON public.image_assets(expires_at) WHERE deleted_at IS NULL AND preserve = false;
CREATE INDEX IF NOT EXISTS idx_image_assets_source ON public.image_assets(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_deleted_at ON public.image_assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_image_assets_processed_at ON public.image_assets(processed_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_assets TO anon, authenticated;
GRANT ALL ON public.image_assets TO service_role;

ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "image_assets read all" ON public.image_assets FOR SELECT USING (true);
CREATE POLICY "image_assets insert all" ON public.image_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "image_assets update all" ON public.image_assets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "image_assets delete all" ON public.image_assets FOR DELETE USING (true);

CREATE TRIGGER trg_image_assets_updated_at
BEFORE UPDATE ON public.image_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
