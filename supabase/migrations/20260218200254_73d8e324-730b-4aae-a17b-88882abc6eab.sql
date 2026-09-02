
-- Add new columns to motoboy_assignments
ALTER TABLE public.motoboy_assignments
ADD COLUMN IF NOT EXISTS ride_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS location text DEFAULT '';
