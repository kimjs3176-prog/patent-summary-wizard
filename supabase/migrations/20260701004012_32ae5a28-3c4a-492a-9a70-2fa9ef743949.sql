
CREATE TABLE public.daily_visits (
  visit_date date PRIMARY KEY,
  visit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.daily_visits TO anon, authenticated;
GRANT ALL ON public.daily_visits TO service_role;

ALTER TABLE public.daily_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read daily visits"
ON public.daily_visits FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION public.increment_daily_visit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.daily_visits (visit_date, visit_count, updated_at)
  VALUES (CURRENT_DATE, 1, now())
  ON CONFLICT (visit_date)
  DO UPDATE SET
    visit_count = public.daily_visits.visit_count + 1,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_daily_visit() TO anon, authenticated;
