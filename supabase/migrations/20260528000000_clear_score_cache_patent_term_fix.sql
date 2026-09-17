-- Bust cached commercialization scores/commentary so patents that were scored
-- before the legal-term assessment fix (assessPatentTerm / remaining-term
-- thresholds in analyze-commercialization) are regenerated with correct
-- "ample remaining protection" wording instead of stale short-term commentary.
TRUNCATE TABLE public.patent_score_cache;
