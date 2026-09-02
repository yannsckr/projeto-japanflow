
-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assignee_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  deadline TEXT NOT NULL,
  sector TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Permissive policies (same pattern as messages - custom auth, no auth.uid())
CREATE POLICY "Allow all read on tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow all insert on tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on tasks" ON public.tasks FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
