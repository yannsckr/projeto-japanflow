
CREATE TABLE public.personal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select personal_notes" ON public.personal_notes FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert personal_notes" ON public.personal_notes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update personal_notes" ON public.personal_notes FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete personal_notes" ON public.personal_notes FOR DELETE TO public USING (true);
