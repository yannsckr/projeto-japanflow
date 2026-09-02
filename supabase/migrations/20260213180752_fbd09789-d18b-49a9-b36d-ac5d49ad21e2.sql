
-- Table for custom group chats created by admins
CREATE TABLE public.custom_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by text NOT NULL,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read custom_groups" ON public.custom_groups FOR SELECT USING (true);
CREATE POLICY "Allow all insert custom_groups" ON public.custom_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update custom_groups" ON public.custom_groups FOR UPDATE USING (true);
CREATE POLICY "Allow all delete custom_groups" ON public.custom_groups FOR DELETE USING (true);

-- Add claimed_by column to counter_quotes for the claiming system
ALTER TABLE public.counter_quotes ADD COLUMN claimed_by text DEFAULT NULL;

-- Enable realtime for custom_groups
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_groups;
