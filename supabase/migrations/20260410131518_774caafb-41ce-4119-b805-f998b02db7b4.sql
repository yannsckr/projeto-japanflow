CREATE POLICY "Allow all delete low_stock_items"
ON public.low_stock_items
FOR DELETE
USING (true);