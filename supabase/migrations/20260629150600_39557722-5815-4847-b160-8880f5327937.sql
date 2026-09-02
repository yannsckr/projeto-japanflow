CREATE TABLE public.work_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  days JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_schedules TO anon, authenticated;
GRANT ALL ON public.work_schedules TO service_role;

ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_schedules_all_select" ON public.work_schedules FOR SELECT USING (true);
CREATE POLICY "work_schedules_all_insert" ON public.work_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "work_schedules_all_update" ON public.work_schedules FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "work_schedules_all_delete" ON public.work_schedules FOR DELETE USING (true);

CREATE TRIGGER work_schedules_set_updated_at
  BEFORE UPDATE ON public.work_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();