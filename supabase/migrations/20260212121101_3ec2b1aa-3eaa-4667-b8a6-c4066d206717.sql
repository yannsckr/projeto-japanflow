
-- Create messages table for persistent chat
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_username TEXT NOT NULL,
  receiver_username TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_name TEXT,
  edited BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS since the app uses custom username/password auth (not Supabase Auth)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (the app handles auth internally)
CREATE POLICY "Allow all read" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.messages FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON public.messages FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
