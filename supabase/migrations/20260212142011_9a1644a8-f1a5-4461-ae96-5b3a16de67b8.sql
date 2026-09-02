
-- Table for persisting users
CREATE TABLE public.app_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  avatar text,
  sectors jsonb NOT NULL DEFAULT '[]'::jsonb,
  function text,
  background_color text DEFAULT '#1a1a2e',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read app_users" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "Allow all insert app_users" ON public.app_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update app_users" ON public.app_users FOR UPDATE USING (true);
CREATE POLICY "Allow all delete app_users" ON public.app_users FOR DELETE USING (true);

-- Seed initial users from mockData
INSERT INTO public.app_users (id, name, username, password, role, sectors, function) VALUES
  ('admin-1', 'Joe', 'joe', 'abcd1234', 'admin', '[]'::jsonb, NULL),
  ('emp-1', 'Carlos Silva', 'carlos', 'abcd1234', 'employee', '["vendas"]'::jsonb, 'Vendedor'),
  ('emp-2', 'Ana Souza', 'ana', 'abcd1234', 'employee', '["expedicao"]'::jsonb, 'Expedidora'),
  ('emp-3', 'Pedro Santos', 'pedro', 'abcd1234', 'employee', '["motoboys"]'::jsonb, 'Motoboy'),
  ('emp-4', 'Maria Oliveira', 'maria', 'abcd1234', 'employee', '["financeiro"]'::jsonb, 'Financeiro'),
  ('emp-5', 'Lucas Pereira', 'lucas', 'abcd1234', 'employee', '["estoque"]'::jsonb, 'Estoquista');

-- Table for group messages (sector chats)
CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL,
  sender_username text NOT NULL,
  content text NOT NULL,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  edited boolean DEFAULT false,
  deleted boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read group_messages" ON public.group_messages FOR SELECT USING (true);
CREATE POLICY "Allow all insert group_messages" ON public.group_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update group_messages" ON public.group_messages FOR UPDATE USING (true);
CREATE POLICY "Allow all delete group_messages" ON public.group_messages FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
