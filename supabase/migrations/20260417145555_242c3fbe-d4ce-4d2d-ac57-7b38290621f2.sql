CREATE TABLE public.user_tab_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  tab_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tab_key)
);

ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read user_tab_permissions" ON public.user_tab_permissions FOR SELECT USING (true);
CREATE POLICY "Allow all insert user_tab_permissions" ON public.user_tab_permissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update user_tab_permissions" ON public.user_tab_permissions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete user_tab_permissions" ON public.user_tab_permissions FOR DELETE USING (true);