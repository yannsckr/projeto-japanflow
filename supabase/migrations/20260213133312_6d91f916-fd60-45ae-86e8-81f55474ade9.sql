
CREATE TABLE public.chat_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  partner_username TEXT NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(username, partner_username)
);

ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat_read_status" ON public.chat_read_status FOR SELECT USING (true);
CREATE POLICY "Anyone can insert chat_read_status" ON public.chat_read_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chat_read_status" ON public.chat_read_status FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_read_status;
