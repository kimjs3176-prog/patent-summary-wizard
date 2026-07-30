CREATE TABLE public.satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_number text,
  rating smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.satisfaction_surveys TO service_role;
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public select on satisfaction_surveys" ON public.satisfaction_surveys FOR SELECT USING (false);
CREATE POLICY "No public insert on satisfaction_surveys" ON public.satisfaction_surveys FOR INSERT WITH CHECK (false);
CREATE POLICY "No public update on satisfaction_surveys" ON public.satisfaction_surveys FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "No public delete on satisfaction_surveys" ON public.satisfaction_surveys FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION public.submit_satisfaction(p_rating smallint, p_patent_number text DEFAULT NULL, p_comment text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;
  INSERT INTO public.satisfaction_surveys (patent_number, rating, comment)
  VALUES (NULLIF(p_patent_number, ''), p_rating, NULLIF(left(coalesce(p_comment, ''), 500), ''));
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_satisfaction(smallint, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_satisfaction_stats()
RETURNS TABLE(bucket text, period text, responses bigint, avg_rating numeric, r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'total'::text, 'all'::text, count(*)::bigint, round(avg(rating), 2),
    count(*) FILTER (WHERE rating = 1)::bigint,
    count(*) FILTER (WHERE rating = 2)::bigint,
    count(*) FILTER (WHERE rating = 3)::bigint,
    count(*) FILTER (WHERE rating = 4)::bigint,
    count(*) FILTER (WHERE rating = 5)::bigint
  FROM public.satisfaction_surveys
  UNION ALL
  SELECT 'monthly'::text, to_char(created_at, 'YYYY-MM'), count(*)::bigint, round(avg(rating), 2),
    count(*) FILTER (WHERE rating = 1)::bigint,
    count(*) FILTER (WHERE rating = 2)::bigint,
    count(*) FILTER (WHERE rating = 3)::bigint,
    count(*) FILTER (WHERE rating = 4)::bigint,
    count(*) FILTER (WHERE rating = 5)::bigint
  FROM public.satisfaction_surveys
  GROUP BY 2
  UNION ALL
  SELECT 'yearly'::text, to_char(created_at, 'YYYY'), count(*)::bigint, round(avg(rating), 2),
    count(*) FILTER (WHERE rating = 1)::bigint,
    count(*) FILTER (WHERE rating = 2)::bigint,
    count(*) FILTER (WHERE rating = 3)::bigint,
    count(*) FILTER (WHERE rating = 4)::bigint,
    count(*) FILTER (WHERE rating = 5)::bigint
  FROM public.satisfaction_surveys
  GROUP BY 2
  ORDER BY 1, 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_satisfaction_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_satisfaction_comments(p_limit integer DEFAULT 30)
RETURNS TABLE(rating smallint, comment text, patent_number text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rating, comment, patent_number, created_at
  FROM public.satisfaction_surveys
  WHERE comment IS NOT NULL
  ORDER BY created_at DESC
  LIMIT least(coalesce(p_limit, 30), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_satisfaction_comments(integer) TO anon, authenticated;