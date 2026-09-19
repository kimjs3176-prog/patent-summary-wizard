-- 1) Lock down AI cache tables: writes are service-role only from now on
DROP POLICY IF EXISTS "Allow public insert on patent_ai_cache" ON public.patent_ai_cache;
DROP POLICY IF EXISTS "Allow public insert on patent_score_cache" ON public.patent_score_cache;

REVOKE INSERT, UPDATE, DELETE ON public.patent_ai_cache FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.patent_score_cache FROM anon, authenticated;

GRANT SELECT ON public.patent_ai_cache TO anon, authenticated;
GRANT SELECT ON public.patent_score_cache TO anon, authenticated;
GRANT ALL ON public.patent_ai_cache TO service_role;
GRANT ALL ON public.patent_score_cache TO service_role;

-- 2) Rate limiting store for public edge functions
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  bucket TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, identifier, window_start)
);

GRANT ALL ON public.edge_rate_limits TO service_role;

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (which bypasses RLS) may touch it.

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_window ON public.edge_rate_limits(window_start);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket TEXT,
  _identifier TEXT,
  _limit INTEGER,
  _window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start TIMESTAMPTZ;
  _count INTEGER;
BEGIN
  _window_start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.edge_rate_limits (bucket, identifier, window_start, request_count)
  VALUES (_bucket, _identifier, _window_start, 1)
  ON CONFLICT (bucket, identifier, window_start)
  DO UPDATE SET request_count = public.edge_rate_limits.request_count + 1
  RETURNING request_count INTO _count;

  -- opportunistic cleanup of stale windows
  IF random() < 0.01 THEN
    DELETE FROM public.edge_rate_limits WHERE window_start < now() - INTERVAL '1 day';
  END IF;

  RETURN _count <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;