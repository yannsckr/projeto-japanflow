-- Trigger que promove automaticamente usuários do setor administracao a admin
CREATE OR REPLACE FUNCTION public.auto_promote_admin_sector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sectors IS NOT NULL 
     AND NEW.sectors::text ILIKE '%administracao%' 
     AND NEW.role IS DISTINCT FROM 'admin' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_admin_sector ON public.app_users;

CREATE TRIGGER trg_auto_promote_admin_sector
BEFORE INSERT OR UPDATE OF sectors ON public.app_users
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_admin_sector();