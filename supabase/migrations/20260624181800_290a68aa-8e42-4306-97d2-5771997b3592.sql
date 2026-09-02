
ALTER TABLE public.counter_orders
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ;
