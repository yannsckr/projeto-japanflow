-- Allow tasks to have no assignee (sector-wide tasks)
ALTER TABLE public.tasks ALTER COLUMN assignee_id DROP NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN assignee_id SET DEFAULT '';