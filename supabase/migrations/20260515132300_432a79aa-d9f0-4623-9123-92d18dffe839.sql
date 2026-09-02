CREATE TABLE IF NOT EXISTS public.user_feature_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

ALTER TABLE public.user_feature_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read user_feature_permissions" ON public.user_feature_permissions FOR SELECT USING (true);
CREATE POLICY "Allow all insert user_feature_permissions" ON public.user_feature_permissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update user_feature_permissions" ON public.user_feature_permissions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete user_feature_permissions" ON public.user_feature_permissions FOR DELETE USING (true);