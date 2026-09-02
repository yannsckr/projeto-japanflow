CREATE TABLE public.inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_code text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_by_id text NOT NULL,
  started_by_name text NOT NULL,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  popup_id uuid,
  task_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventories TO authenticated, anon;
GRANT ALL ON public.inventories TO service_role;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read inventories" ON public.inventories FOR SELECT USING (true);
CREATE POLICY "Allow all insert inventories" ON public.inventories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update inventories" ON public.inventories FOR UPDATE USING (true);
CREATE POLICY "Allow all delete inventories" ON public.inventories FOR DELETE USING (true);
CREATE TRIGGER trg_inventories_updated_at BEFORE UPDATE ON public.inventories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventories;