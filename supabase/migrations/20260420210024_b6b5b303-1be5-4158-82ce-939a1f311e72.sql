CREATE TABLE IF NOT EXISTS public.bulletin_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.bulletin_acks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read bulletin_acks" ON public.bulletin_acks FOR SELECT USING (true);
CREATE POLICY "Allow all insert bulletin_acks" ON public.bulletin_acks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete bulletin_acks" ON public.bulletin_acks FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_bulletin_acks_user ON public.bulletin_acks(user_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_acks_post ON public.bulletin_acks(post_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.bulletin_acks;
ALTER TABLE public.bulletin_acks REPLICA IDENTITY FULL;