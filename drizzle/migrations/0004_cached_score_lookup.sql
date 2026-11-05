-- Read-only lookup of already-cached commercialization scores for list exports (일괄조회·목록 다운로드).
--
-- patent_score_cache stays locked to the service role (its public read policy was dropped on purpose in
-- 20261003100338). This SECURITY DEFINER function exposes only the three columns an export needs, for at
-- most 200 keys per call, and never triggers an analysis. The same total score and TRL are already shown
-- publicly on every patent's summary page, so no new information becomes readable.
CREATE OR REPLACE FUNCTION public.get_cached_scores(p_numbers text[])
RETURNS TABLE(patent_number text, total_score integer, trl integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.patent_number, c.total_score::integer, c.trl::integer
  FROM public.patent_score_cache c
  WHERE c.patent_number = ANY (
    SELECT n FROM unnest(p_numbers[1:200]) AS n
    WHERE n ~ '^[0-9][0-9-]{6,18}[0-9]$'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_cached_scores(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cached_scores(text[]) TO anon, authenticated, service_role;
