
-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  cnpj text,
  celular text,
  endereco text,
  cep text,
  municipio_uf text,
  email text,
  contato text,
  obs text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated, anon;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers all" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

-- Purchase Orders
CREATE SEQUENCE IF NOT EXISTS public.purchase_order_number_seq START 1;

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number integer NOT NULL DEFAULT nextval('public.purchase_order_number_seq'),
  comprador_id text,
  comprador_nome text,
  escopo text DEFAULT 'Reposição Estoque / Encomenda Balcão',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_snapshot jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(12,2) DEFAULT 0,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.purchase_order_number_seq OWNED BY public.purchase_orders.order_number;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated, anon;
GRANT ALL ON public.purchase_orders TO service_role;
GRANT USAGE ON SEQUENCE public.purchase_order_number_seq TO authenticated, anon, service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders all" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);
