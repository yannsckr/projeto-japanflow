
CREATE TABLE public.task_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granter_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('employee', 'sector')),
  target_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read task_permissions" ON public.task_permissions FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert task_permissions" ON public.task_permissions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all delete task_permissions" ON public.task_permissions FOR DELETE TO public USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_permissions;
