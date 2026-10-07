CREATE TABLE public.market_reference (
  market_key text PRIMARY KEY,
  label text NOT NULL,
  base_year integer NOT NULL,
  base_value_eok numeric NOT NULL,
  cagr numeric NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_reference ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_reference FROM anon, authenticated;
GRANT ALL ON public.market_reference TO service_role;