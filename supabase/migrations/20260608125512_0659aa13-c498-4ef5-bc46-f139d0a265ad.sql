CREATE TABLE public.awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id text NOT NULL,
  title text NOT NULL,
  amount numeric,
  period text,
  notes text,
  document_url text,
  document_name text,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.awards TO authenticated, anon;
GRANT ALL ON public.awards TO service_role;
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read awards" ON public.awards FOR SELECT USING (true);
CREATE POLICY "Allow all insert awards" ON public.awards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update awards" ON public.awards FOR UPDATE USING (true);
CREATE POLICY "Allow all delete awards" ON public.awards FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.awards;