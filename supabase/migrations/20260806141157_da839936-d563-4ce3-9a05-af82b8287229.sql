CREATE TABLE public.internal_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  created_by text NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_policies TO anon, authenticated;
GRANT ALL ON public.internal_policies TO service_role;

ALTER TABLE public.internal_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_policies_all" ON public.internal_policies FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER internal_policies_set_updated_at
BEFORE UPDATE ON public.internal_policies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_policies;