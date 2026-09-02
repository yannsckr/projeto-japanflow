
-- Allow delete on motoboy_assignments
CREATE POLICY "Allow all delete motoboy_assignments"
ON public.motoboy_assignments
FOR DELETE
USING (true);
