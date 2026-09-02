CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings read all" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings write all" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;