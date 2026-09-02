
CREATE TABLE public.freight_rates (
  kind TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  carrier TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  per_km_rate NUMERIC NULL,
  options JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_rates TO authenticated, anon;
GRANT ALL ON public.freight_rates TO service_role;
ALTER TABLE public.freight_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freight_rates readable to all" ON public.freight_rates FOR SELECT USING (true);
CREATE POLICY "freight_rates writable to all" ON public.freight_rates FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.freight_rates (kind, label, carrier, price, deadline, notes, per_km_rate, options) VALUES
('motoboy', 'Motoboy próximo (Taubaté, Jacareí, Caçapava, Tremembé, Monteiro Lobato)', 'Motoboy particular Japan Imports', '', 'Mesmo dia (sujeito à disponibilidade)', 'Cálculo: R$ 1,00 por km rodado, ida + volta', 1.00, NULL),
('pedrinho', 'Pedrinho (Caraguatatuba, São Sebastião, Ilhabela)', 'Pedrinho', 'R$ 60,00', 'Entrega no mesmo dia até 18h00 (coleta até 09h30)', 'Compras confirmadas após 09h30 seguem apenas no dia útil seguinte.', NULL, NULL),
('ph_next_day', 'PH — Ubatuba / Campos do Jordão', 'Transportadora PH', 'R$ 90,00', 'Entrega no dia seguinte', 'PH coleta aqui na loja', NULL, NULL),
('ph_same_day', 'PH — Guaratinguetá / Pindamonhangaba / Lorena', 'Transportadora PH', 'R$ 60,00', 'Entrega no mesmo dia', 'PH coleta aqui na loja pela manhã', NULL, NULL),
('ze_gordinho', 'Zé Gordinho (São Bento do Sapucaí, Paraisópolis)', 'Zé Gordinho', 'R$ 60,00', 'Entrega no dia seguinte', 'Coleta até o final da tarde', NULL, NULL),
('sp_capital', 'São Paulo capital (múltiplas opções)', 'Múltiplas opções (confirmar disponibilidade)', 'R$ 100,00 a R$ 150,00', 'Mesmo dia ou dia seguinte', 'Confirmar disponibilidade com o transportador', NULL,
  '[
    {"carrier":"Ednei Motoboy","price":"R$ 120,00 a R$ 150,00","deadline":"Coleta até 09h00 — entrega no mesmo dia","notes":""},
    {"carrier":"Flávio Motoboy","price":"R$ 100,00","deadline":"Coleta até 14h00 — entrega no mesmo dia","notes":""},
    {"carrier":"Edvaldo","price":"R$ 120,00","deadline":"Coleta e entrega no dia seguinte","notes":"Indicado para peças grandes"}
  ]'::jsonb),
('sp_metro', 'SP Grande (São Bernardo, Santos, Osasco, Guarulhos)', 'Flávio Motoboy', 'R$ 120,00 a R$ 150,00', 'Coleta até 14h00 — entrega no mesmo dia', 'Confirmar disponibilidade com o transportador', NULL, NULL);
