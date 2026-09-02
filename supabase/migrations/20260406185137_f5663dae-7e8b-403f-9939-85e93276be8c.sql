
CREATE TABLE public.scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  assignee_id text DEFAULT NULL,
  sector text DEFAULT NULL,
  assign_mode text NOT NULL DEFAULT 'employee',
  schedule_time text NOT NULL DEFAULT '08:00',
  recurrence text NOT NULL DEFAULT 'daily',
  days_of_week jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_created_at text DEFAULT NULL
);

ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read scheduled_tasks" ON public.scheduled_tasks FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert scheduled_tasks" ON public.scheduled_tasks FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update scheduled_tasks" ON public.scheduled_tasks FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete scheduled_tasks" ON public.scheduled_tasks FOR DELETE TO public USING (true);
