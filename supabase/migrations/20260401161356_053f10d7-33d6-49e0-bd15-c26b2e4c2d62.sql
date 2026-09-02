
CREATE TABLE public.personal_note_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  shared_with_user_id text NOT NULL,
  shared_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_note_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select personal_note_shares" ON public.personal_note_shares FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert personal_note_shares" ON public.personal_note_shares FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all delete personal_note_shares" ON public.personal_note_shares FOR DELETE TO public USING (true);
