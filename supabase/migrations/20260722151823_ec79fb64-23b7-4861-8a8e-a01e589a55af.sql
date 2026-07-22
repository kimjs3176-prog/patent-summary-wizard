
CREATE TABLE IF NOT EXISTS public.patent_search_events (
  id BIGSERIAL PRIMARY KEY,
  patent_number TEXT NOT NULL,
  patent_title TEXT,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pse_searched_at ON public.patent_search_events(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_pse_patent_number ON public.patent_search_events(patent_number);

GRANT SELECT ON public.patent_search_events TO anon, authenticated;
GRANT ALL ON public.patent_search_events TO service_role;

ALTER TABLE public.patent_search_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patent_search_events' AND policyname='Public read search events') THEN
    CREATE POLICY "Public read search events" ON public.patent_search_events FOR SELECT USING (true);
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.upsert_search_stat(text, text);

CREATE OR REPLACE FUNCTION public.upsert_search_stat(p_patent_number TEXT, p_patent_title TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.patent_search_stats (patent_number, patent_title, search_count, last_searched_at)
  VALUES (p_patent_number, p_patent_title, 1, now())
  ON CONFLICT (patent_number) DO UPDATE SET
    search_count = public.patent_search_stats.search_count + 1,
    last_searched_at = now(),
    patent_title = COALESCE(EXCLUDED.patent_title, public.patent_search_stats.patent_title);

  INSERT INTO public.patent_search_events (patent_number, patent_title)
  VALUES (p_patent_number, p_patent_title);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_popular_searches(p_limit INT DEFAULT 6)
RETURNS TABLE (patent_number TEXT, patent_title TEXT, search_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.patent_number,
    (ARRAY_AGG(e.patent_title ORDER BY e.searched_at DESC) FILTER (WHERE e.patent_title IS NOT NULL))[1] AS patent_title,
    COUNT(*)::BIGINT AS search_count
  FROM public.patent_search_events e
  WHERE e.searched_at >= date_trunc('month', now())
  GROUP BY e.patent_number
  ORDER BY search_count DESC, MAX(e.searched_at) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_popular_searches(INT) TO anon, authenticated;
