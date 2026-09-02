ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS response_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS response_likes jsonb NOT NULL DEFAULT '[]'::jsonb;