-- Drop trigger that forces status to pending so admin updates can stick, keep validation
DROP TRIGGER IF EXISTS hrp_force_pending_trigger ON public.highlight_rule_proposals;
DROP TRIGGER IF EXISTS trg_hrp_force_pending ON public.highlight_rule_proposals;

CREATE OR REPLACE FUNCTION public.hrp_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phrase IS NULL OR length(trim(NEW.phrase)) < 2 OR length(NEW.phrase) > 200 THEN
    RAISE EXCEPTION 'phrase length must be 2-200';
  END IF;
  IF NEW.context IS NOT NULL AND length(NEW.context) > 500 THEN
    NEW.context := substring(NEW.context, 1, 500);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hrp_validate
BEFORE INSERT OR UPDATE ON public.highlight_rule_proposals
FOR EACH ROW EXECUTE FUNCTION public.hrp_validate();

-- Approve currently pending rules
UPDATE public.highlight_rule_proposals
SET status = 'approved', reviewed_at = now()
WHERE status = 'pending';