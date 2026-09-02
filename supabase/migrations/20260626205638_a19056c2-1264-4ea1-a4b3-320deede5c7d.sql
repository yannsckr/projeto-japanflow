
CREATE TABLE IF NOT EXISTS public.storage_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  category TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'reported',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_audit_log_run_id_idx ON public.storage_audit_log(run_id);
CREATE INDEX IF NOT EXISTS storage_audit_log_category_idx ON public.storage_audit_log(category);
CREATE INDEX IF NOT EXISTS storage_audit_log_created_at_idx ON public.storage_audit_log(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_audit_log TO authenticated;
GRANT SELECT ON public.storage_audit_log TO anon;
GRANT ALL ON public.storage_audit_log TO service_role;

ALTER TABLE public.storage_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit log"
  ON public.storage_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert audit log"
  ON public.storage_audit_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update audit log"
  ON public.storage_audit_log FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete audit log"
  ON public.storage_audit_log FOR DELETE
  USING (true);
