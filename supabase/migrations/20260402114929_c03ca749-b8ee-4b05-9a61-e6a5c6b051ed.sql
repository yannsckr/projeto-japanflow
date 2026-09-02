
-- Table to track user presence (online/offline/paused)
CREATE TABLE public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'offline',
  pause_type text,
  pause_started_at timestamp with time zone,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select user_presence" ON public.user_presence FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert user_presence" ON public.user_presence FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update user_presence" ON public.user_presence FOR UPDATE TO public USING (true);

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Table to track pause history for admin reports
CREATE TABLE public.pause_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  pause_type text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  overtime_seconds integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pause_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select pause_history" ON public.pause_history FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert pause_history" ON public.pause_history FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update pause_history" ON public.pause_history FOR UPDATE TO public USING (true);

-- Table to track online/offline sessions
CREATE TABLE public.presence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  status text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer
);

ALTER TABLE public.presence_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select presence_sessions" ON public.presence_sessions FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert presence_sessions" ON public.presence_sessions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update presence_sessions" ON public.presence_sessions FOR UPDATE TO public USING (true);
