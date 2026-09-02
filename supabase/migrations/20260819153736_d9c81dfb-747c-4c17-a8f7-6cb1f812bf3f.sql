DROP POLICY IF EXISTS "Allow all delete" ON public.messages;
DROP POLICY IF EXISTS "Allow all delete group_messages" ON public.group_messages;
REVOKE DELETE ON public.messages FROM anon, authenticated;
REVOKE DELETE ON public.group_messages FROM anon, authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.group_messages TO service_role;