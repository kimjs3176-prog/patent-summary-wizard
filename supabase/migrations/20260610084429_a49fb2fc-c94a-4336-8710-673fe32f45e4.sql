
CREATE TABLE public.highlight_rule_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('exclude','include')),
  phrase text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  patent_number text,
  context text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX idx_hrp_status ON public.highlight_rule_proposals(status);
CREATE INDEX idx_hrp_created ON public.highlight_rule_proposals(created_at DESC);
CREATE UNIQUE INDEX idx_hrp_unique_phrase ON public.highlight_rule_proposals(kind, lower(phrase));

GRANT SELECT, INSERT ON public.highlight_rule_proposals TO anon;
GRANT SELECT, INSERT ON public.highlight_rule_proposals TO authenticated;
GRANT ALL ON public.highlight_rule_proposals TO service_role;

ALTER TABLE public.highlight_rule_proposals ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved rules (runtime needs them)
CREATE POLICY "read approved" ON public.highlight_rule_proposals
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- Anyone can propose (insert) — trigger forces pending status
CREATE POLICY "propose insert" ON public.highlight_rule_proposals
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Trigger: enforce 'pending' on insert regardless of payload
CREATE OR REPLACE FUNCTION public.hrp_force_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.status := 'pending';
  NEW.reviewed_at := NULL;
  IF NEW.phrase IS NULL OR length(trim(NEW.phrase)) < 2 OR length(NEW.phrase) > 200 THEN
    RAISE EXCEPTION 'phrase length must be 2-200';
  END IF;
  IF NEW.context IS NOT NULL AND length(NEW.context) > 500 THEN
    NEW.context := substring(NEW.context, 1, 500);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hrp_force_pending
BEFORE INSERT ON public.highlight_rule_proposals
FOR EACH ROW EXECUTE FUNCTION public.hrp_force_pending();
