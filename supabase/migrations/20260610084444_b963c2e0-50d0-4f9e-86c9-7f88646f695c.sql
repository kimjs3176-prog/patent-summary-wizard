
DROP POLICY IF EXISTS "propose insert" ON public.highlight_rule_proposals;
CREATE POLICY "propose insert" ON public.highlight_rule_proposals
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    kind IN ('exclude','include')
    AND char_length(phrase) BETWEEN 2 AND 200
    AND status = 'pending'
  );

REVOKE EXECUTE ON FUNCTION public.hrp_force_pending() FROM PUBLIC, anon, authenticated;
