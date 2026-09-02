
CREATE TABLE public.pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_title text NOT NULL,
  delivery_type text NOT NULL,
  carrier_name text,
  details text,
  task_id uuid,
  created_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by text,
  completed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickups TO authenticated, anon;
GRANT ALL ON public.pickups TO service_role;

ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pickups_all_read" ON public.pickups FOR SELECT USING (true);
CREATE POLICY "pickups_all_insert" ON public.pickups FOR INSERT WITH CHECK (true);
CREATE POLICY "pickups_all_update" ON public.pickups FOR UPDATE USING (true);
CREATE POLICY "pickups_all_delete" ON public.pickups FOR DELETE USING (true);

CREATE TRIGGER pickups_set_updated_at BEFORE UPDATE ON public.pickups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pickups;
