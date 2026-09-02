
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS linked_counter_order_id uuid;

CREATE OR REPLACE FUNCTION public.complete_counter_order_on_task_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur jsonb;
  evt jsonb;
BEGIN
  IF NEW.linked_counter_order_id IS NOT NULL
     AND NEW.status = 'done'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT COALESCE(status_history, '[]'::jsonb) INTO cur
      FROM public.counter_orders WHERE id = NEW.linked_counter_order_id;
    evt := jsonb_build_object(
      'status', 'completed',
      'at', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'by_id', NEW.assignee_id,
      'by_name', NULL
    );
    UPDATE public.counter_orders
      SET status = 'completed',
          status_history = COALESCE(cur, '[]'::jsonb) || evt
    WHERE id = NEW.linked_counter_order_id
      AND status <> 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_counter_order_on_task_done ON public.tasks;
CREATE TRIGGER trg_complete_counter_order_on_task_done
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.complete_counter_order_on_task_done();
