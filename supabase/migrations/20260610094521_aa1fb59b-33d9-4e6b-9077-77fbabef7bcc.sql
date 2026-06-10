ALTER TABLE public.highlight_rule_proposals
  ADD COLUMN IF NOT EXISTS weight smallint NOT NULL DEFAULT 2
  CHECK (weight BETWEEN 1 AND 3);