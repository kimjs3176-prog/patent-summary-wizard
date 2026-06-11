DROP TRIGGER IF EXISTS hrp_force_pending_trigger ON public.highlight_rule_proposals;
DROP TRIGGER IF EXISTS trg_hrp_force_pending ON public.highlight_rule_proposals;
DROP TRIGGER IF EXISTS trg_hrp_validate ON public.highlight_rule_proposals;
DROP TABLE IF EXISTS public.highlight_rule_proposals;
DROP FUNCTION IF EXISTS public.hrp_force_pending();
DROP FUNCTION IF EXISTS public.hrp_validate();