
CREATE TABLE public.carriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carriers TO anon, authenticated;
GRANT ALL ON public.carriers TO service_role;

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carriers readable by all" ON public.carriers FOR SELECT USING (true);
CREATE POLICY "Carriers insertable by all" ON public.carriers FOR INSERT WITH CHECK (true);
CREATE POLICY "Carriers updatable by all" ON public.carriers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Carriers deletable by all" ON public.carriers FOR DELETE USING (true);

CREATE TRIGGER carriers_set_updated_at BEFORE UPDATE ON public.carriers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.carriers (name) VALUES ('JadLog'), ('J&T') ON CONFLICT (name) DO NOTHING;
