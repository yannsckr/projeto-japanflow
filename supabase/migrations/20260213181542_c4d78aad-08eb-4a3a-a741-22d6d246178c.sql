-- Allow deleting counter_quotes
CREATE POLICY "Allow all delete counter_quotes"
ON public.counter_quotes
FOR DELETE
USING (true);