
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read task_comments" ON public.task_comments FOR SELECT USING (true);
CREATE POLICY "Allow all insert task_comments" ON public.task_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete task_comments" ON public.task_comments FOR DELETE USING (true);

CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
