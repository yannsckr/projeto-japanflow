
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all insert push_subscriptions" ON public.push_subscriptions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all select push_subscriptions" ON public.push_subscriptions FOR SELECT TO public USING (true);
CREATE POLICY "Allow all delete push_subscriptions" ON public.push_subscriptions FOR DELETE TO public USING (true);
CREATE POLICY "Allow all update push_subscriptions" ON public.push_subscriptions FOR UPDATE TO public USING (true);
