
-- 1. Add client_name and shipping_method to tracking_entries
ALTER TABLE public.tracking_entries ADD COLUMN client_name text NOT NULL DEFAULT '';
ALTER TABLE public.tracking_entries ADD COLUMN shipping_method text NOT NULL DEFAULT '';

-- 2. Add expires_at to polls for auto-close deadline
ALTER TABLE public.polls ADD COLUMN expires_at timestamp with time zone DEFAULT NULL;

-- 3. Add timestamps to motoboy_assignments for accept/complete tracking
ALTER TABLE public.motoboy_assignments ADD COLUMN accepted_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.motoboy_assignments ADD COLUMN completed_at timestamp with time zone DEFAULT NULL;
