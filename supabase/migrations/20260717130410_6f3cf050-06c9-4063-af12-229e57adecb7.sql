
CREATE TABLE public.shared_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id text NOT NULL,
  owner_name text,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  shared_with jsonb NOT NULL DEFAULT '[]'::jsonb,
  share_all boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_documents TO authenticated, anon;
GRANT ALL ON public.shared_documents TO service_role;
ALTER TABLE public.shared_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared_documents_all" ON public.shared_documents FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_shared_documents_updated BEFORE UPDATE ON public.shared_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
