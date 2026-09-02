
CREATE OR REPLACE FUNCTION public.set_updated_at_freight_dest()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.freight_destinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_slug TEXT NOT NULL UNIQUE,
  city_name TEXT NOT NULL,
  carrier TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  per_km_rate NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_destinations TO authenticated;
GRANT SELECT ON public.freight_destinations TO anon;
GRANT ALL ON public.freight_destinations TO service_role;

ALTER TABLE public.freight_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read freight destinations"
  ON public.freight_destinations FOR SELECT USING (true);

CREATE POLICY "Anyone can manage freight destinations"
  ON public.freight_destinations FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_freight_destinations_updated
  BEFORE UPDATE ON public.freight_destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_freight_dest();

INSERT INTO public.freight_destinations (city_slug, city_name, carrier, price, deadline, notes, per_km_rate, sort_order) VALUES
  ('taubate',              'Taubaté',                'Motoboy particular Japan Imports', '', 'Mesmo dia (sujeito à disponibilidade)', 'Cálculo: R$ 1,00 por km rodado, ida + volta', 1.00, 10),
  ('jacarei',              'Jacareí',                'Motoboy particular Japan Imports', '', 'Mesmo dia (sujeito à disponibilidade)', 'Cálculo: R$ 1,00 por km rodado, ida + volta', 1.00, 20),
  ('cacapava',             'Caçapava',               'Motoboy particular Japan Imports', '', 'Mesmo dia (sujeito à disponibilidade)', 'Cálculo: R$ 1,00 por km rodado, ida + volta', 1.00, 30),
  ('tremembe',             'Tremembé',               'Motoboy particular Japan Imports', '', 'Mesmo dia (sujeito à disponibilidade)', 'Cálculo: R$ 1,00 por km rodado, ida + volta', 1.00, 40),
  ('monteiro lobato',      'Monteiro Lobato',        'Motoboy particular Japan Imports', '', 'Mesmo dia (sujeito à disponibilidade)', 'Cálculo: R$ 1,00 por km rodado, ida + volta', 1.00, 50),
  ('caraguatatuba',        'Caraguatatuba',          'Pedrinho', 'R$ 60,00', 'Entrega no mesmo dia até 18h00 (coleta até 09h30)', 'Compras confirmadas após 09h30 seguem apenas no dia útil seguinte.', NULL, 60),
  ('sao sebastiao',        'São Sebastião',          'Pedrinho', 'R$ 60,00', 'Entrega no mesmo dia até 18h00 (coleta até 09h30)', 'Compras confirmadas após 09h30 seguem apenas no dia útil seguinte.', NULL, 70),
  ('ilhabela',             'Ilhabela',               'Pedrinho', 'R$ 60,00', 'Entrega no mesmo dia até 18h00 (coleta até 09h30)', 'Cliente de Ilhabela coleta com o transportador na entrada da balsa de São Sebastião.', NULL, 80),
  ('guaratingueta',        'Guaratinguetá',          'Transportadora PH', 'R$ 60,00', 'Entrega no mesmo dia', 'PH coleta aqui na loja pela manhã', NULL, 90),
  ('pindamonhangaba',      'Pindamonhangaba',        'Transportadora PH', 'R$ 60,00', 'Entrega no mesmo dia', 'PH coleta aqui na loja pela manhã', NULL, 100),
  ('lorena',               'Lorena',                 'Transportadora PH', 'R$ 60,00', 'Entrega no mesmo dia', 'PH coleta aqui na loja pela manhã', NULL, 110),
  ('ubatuba',              'Ubatuba',                'Transportadora PH', 'R$ 90,00', 'Entrega no dia seguinte', 'PH coleta aqui na loja', NULL, 120),
  ('campos do jordao',     'Campos do Jordão',       'Transportadora PH', 'R$ 90,00', 'Entrega no dia seguinte', 'PH coleta aqui na loja', NULL, 130),
  ('sao bento do sapucai', 'São Bento do Sapucaí',   'Zé Gordinho', 'R$ 60,00', 'Entrega no dia seguinte', 'Coleta até o final da tarde', NULL, 140),
  ('paraisopolis',         'Paraisópolis',           'Zé Gordinho', 'R$ 60,00', 'Entrega no dia seguinte', 'Coleta até o final da tarde', NULL, 150),
  ('sao paulo',            'São Paulo (capital)',    'Múltiplas opções (confirmar disponibilidade)', 'R$ 100,00 a R$ 150,00', 'Mesmo dia ou dia seguinte', 'Confirmar disponibilidade com o transportador', NULL, 160),
  ('sao bernardo do campo','São Bernardo do Campo',  'Flávio Motoboy', 'R$ 120,00 a R$ 150,00', 'Coleta até 14h00 — entrega no mesmo dia', 'Confirmar disponibilidade com o transportador', NULL, 170),
  ('santos',               'Santos',                 'Flávio Motoboy', 'R$ 120,00 a R$ 150,00', 'Coleta até 14h00 — entrega no mesmo dia', 'Confirmar disponibilidade com o transportador', NULL, 180),
  ('osasco',               'Osasco',                 'Flávio Motoboy', 'R$ 120,00 a R$ 150,00', 'Coleta até 14h00 — entrega no mesmo dia', 'Confirmar disponibilidade com o transportador', NULL, 190),
  ('guarulhos',            'Guarulhos',              'Flávio Motoboy', 'R$ 120,00 a R$ 150,00', 'Coleta até 14h00 — entrega no mesmo dia', 'Confirmar disponibilidade com o transportador', NULL, 200);

DROP TABLE IF EXISTS public.freight_rates;
