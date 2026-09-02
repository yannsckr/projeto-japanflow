
CREATE TABLE public.admin_popups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  created_by text NOT NULL,
  target_mode text NOT NULL DEFAULT 'all',
  target_sectors jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_users jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_popups TO anon, authenticated;
GRANT ALL ON public.admin_popups TO service_role;

ALTER TABLE public.admin_popups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read admin_popups" ON public.admin_popups FOR SELECT USING (true);
CREATE POLICY "Allow all insert admin_popups" ON public.admin_popups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update admin_popups" ON public.admin_popups FOR UPDATE USING (true);
CREATE POLICY "Allow all delete admin_popups" ON public.admin_popups FOR DELETE USING (true);

CREATE TABLE public.admin_popup_acks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  popup_id uuid NOT NULL,
  user_id text NOT NULL,
  acknowledged_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(popup_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.admin_popup_acks TO anon, authenticated;
GRANT ALL ON public.admin_popup_acks TO service_role;

ALTER TABLE public.admin_popup_acks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read admin_popup_acks" ON public.admin_popup_acks FOR SELECT USING (true);
CREATE POLICY "Allow all insert admin_popup_acks" ON public.admin_popup_acks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete admin_popup_acks" ON public.admin_popup_acks FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_popups;
