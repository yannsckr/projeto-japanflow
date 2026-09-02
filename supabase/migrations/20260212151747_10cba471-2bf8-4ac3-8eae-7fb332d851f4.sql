
-- Financial weekly forecasts
CREATE TABLE public.financial_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date TEXT NOT NULL, -- e.g. '2025-02-10' (Monday)
  day_label TEXT NOT NULL, -- e.g. 'Segunda-feira', 'Terça-feira'...
  day_date TEXT NOT NULL, -- e.g. '2025-02-10'
  predicted_cash NUMERIC NOT NULL DEFAULT 0,
  predicted_expenses NUMERIC NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read financial_forecasts" ON public.financial_forecasts FOR SELECT USING (true);
CREATE POLICY "Allow all insert financial_forecasts" ON public.financial_forecasts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update financial_forecasts" ON public.financial_forecasts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete financial_forecasts" ON public.financial_forecasts FOR DELETE USING (true);

-- Card due dates
CREATE TABLE public.card_due_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  due_date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.card_due_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read card_due_dates" ON public.card_due_dates FOR SELECT USING (true);
CREATE POLICY "Allow all insert card_due_dates" ON public.card_due_dates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update card_due_dates" ON public.card_due_dates FOR UPDATE USING (true);
CREATE POLICY "Allow all delete card_due_dates" ON public.card_due_dates FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_forecasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_due_dates;
