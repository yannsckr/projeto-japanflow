CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.counter_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  code text,
  application text,
  quantity numeric NOT NULL DEFAULT 1,
  brand text,
  purchase_value numeric,
  sold_value numeric,
  deadline text,
  supplier text,
  link text,
  status text NOT NULL DEFAULT 'pending',
  created_by_id text,
  created_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.counter_orders TO anon, authenticated;
GRANT ALL ON public.counter_orders TO service_role;

ALTER TABLE public.counter_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counter_orders open access" ON public.counter_orders
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER counter_orders_updated_at
BEFORE UPDATE ON public.counter_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();