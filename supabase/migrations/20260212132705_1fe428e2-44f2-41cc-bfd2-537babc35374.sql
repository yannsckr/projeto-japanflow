
-- Calendar Events table
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  date text NOT NULL,
  time text,
  user_id text NOT NULL,
  created_by text NOT NULL,
  type text NOT NULL DEFAULT 'event',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read calendar_events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Allow all insert calendar_events" ON public.calendar_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update calendar_events" ON public.calendar_events FOR UPDATE USING (true);
CREATE POLICY "Allow all delete calendar_events" ON public.calendar_events FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  type text NOT NULL DEFAULT 'task_created',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow all insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Allow all delete notifications" ON public.notifications FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Bulletin Board (Mural da Empresa)
CREATE TABLE public.bulletin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  created_by text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bulletin_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read bulletin_posts" ON public.bulletin_posts FOR SELECT USING (true);
CREATE POLICY "Allow all insert bulletin_posts" ON public.bulletin_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update bulletin_posts" ON public.bulletin_posts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete bulletin_posts" ON public.bulletin_posts FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulletin_posts;

-- Suggestions (Sugestões)
CREATE TABLE public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read suggestions" ON public.suggestions FOR SELECT USING (true);
CREATE POLICY "Allow all insert suggestions" ON public.suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update suggestions" ON public.suggestions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete suggestions" ON public.suggestions FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;

-- Polls (Enquetes)
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  created_by text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Allow all insert polls" ON public.polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update polls" ON public.polls FOR UPDATE USING (true);
CREATE POLICY "Allow all delete polls" ON public.polls FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;

CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read poll_options" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Allow all insert poll_options" ON public.poll_options FOR INSERT WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;

CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  voter_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_id)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read poll_votes" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "Allow all insert poll_votes" ON public.poll_votes FOR INSERT WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- Tracking (Rastreamentos)
CREATE TABLE public.tracking_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tracking_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read tracking_entries" ON public.tracking_entries FOR SELECT USING (true);
CREATE POLICY "Allow all insert tracking_entries" ON public.tracking_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update tracking_entries" ON public.tracking_entries FOR UPDATE USING (true);
CREATE POLICY "Allow all delete tracking_entries" ON public.tracking_entries FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_entries;

-- Reverse Shipments (Envios Reversos)
CREATE TABLE public.reverse_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  tracking_code text,
  status text NOT NULL DEFAULT 'requested',
  requested_by text NOT NULL,
  responded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reverse_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read reverse_shipments" ON public.reverse_shipments FOR SELECT USING (true);
CREATE POLICY "Allow all insert reverse_shipments" ON public.reverse_shipments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update reverse_shipments" ON public.reverse_shipments FOR UPDATE USING (true);
CREATE POLICY "Allow all delete reverse_shipments" ON public.reverse_shipments FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.reverse_shipments;

-- Receipts / Notinhas (Motoboys)
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL DEFAULT '',
  photo_url text,
  created_by text NOT NULL,
  liked_by jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read receipts" ON public.receipts FOR SELECT USING (true);
CREATE POLICY "Allow all insert receipts" ON public.receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update receipts" ON public.receipts FOR UPDATE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;

-- Counter Quotes (Orçamentos de Balcão)
CREATE TABLE public.counter_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'requested',
  requested_by text NOT NULL,
  responded_by text,
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.counter_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read counter_quotes" ON public.counter_quotes FOR SELECT USING (true);
CREATE POLICY "Allow all insert counter_quotes" ON public.counter_quotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update counter_quotes" ON public.counter_quotes FOR UPDATE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.counter_quotes;

-- Low Stock Items (Produtos Esgotando)
CREATE TABLE public.low_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  photo_url text,
  status text NOT NULL DEFAULT 'reported',
  reported_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.low_stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read low_stock_items" ON public.low_stock_items FOR SELECT USING (true);
CREATE POLICY "Allow all insert low_stock_items" ON public.low_stock_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update low_stock_items" ON public.low_stock_items FOR UPDATE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.low_stock_items;

-- Supply Requests (Suprimentos)
CREATE TABLE public.supply_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'requested',
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supply_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read supply_requests" ON public.supply_requests FOR SELECT USING (true);
CREATE POLICY "Allow all insert supply_requests" ON public.supply_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update supply_requests" ON public.supply_requests FOR UPDATE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.supply_requests;

-- Motoboy Assignments (Monitoria Motoboys)
CREATE TABLE public.motoboy_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  assigned_to text NOT NULL,
  assigned_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.motoboy_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read motoboy_assignments" ON public.motoboy_assignments FOR SELECT USING (true);
CREATE POLICY "Allow all insert motoboy_assignments" ON public.motoboy_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update motoboy_assignments" ON public.motoboy_assignments FOR UPDATE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoboy_assignments;

-- Storage bucket for receipts/photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);
CREATE POLICY "Allow all read attachments" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Allow all insert attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments');
