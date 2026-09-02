
CREATE TABLE public.bulletin_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one emoji type per user per post
ALTER TABLE public.bulletin_reactions ADD CONSTRAINT unique_user_post_emoji UNIQUE (post_id, user_id, emoji);

-- Enable RLS
ALTER TABLE public.bulletin_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read bulletin_reactions" ON public.bulletin_reactions FOR SELECT USING (true);
CREATE POLICY "Allow all insert bulletin_reactions" ON public.bulletin_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete bulletin_reactions" ON public.bulletin_reactions FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulletin_reactions;
