
-- Create table to track patent search statistics
CREATE TABLE public.patent_search_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patent_number TEXT NOT NULL,
  patent_title TEXT,
  search_count INTEGER NOT NULL DEFAULT 1,
  last_searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on patent_number
CREATE UNIQUE INDEX idx_patent_search_stats_number ON public.patent_search_stats(patent_number);

-- Create index for ranking queries
CREATE INDEX idx_patent_search_stats_count ON public.patent_search_stats(search_count DESC);

-- Enable RLS
ALTER TABLE public.patent_search_stats ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see popular searches)
CREATE POLICY "Anyone can read search stats"
  ON public.patent_search_stats
  FOR SELECT
  USING (true);

-- Public insert/update via edge function (using service role in edge function)
-- For now allow anon insert/update so the app can track searches
CREATE POLICY "Anyone can insert search stats"
  ON public.patent_search_stats
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update search stats"
  ON public.patent_search_stats
  FOR UPDATE
  USING (true);

-- Function to upsert search stats
CREATE OR REPLACE FUNCTION public.upsert_search_stat(p_patent_number TEXT, p_patent_title TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO public.patent_search_stats (patent_number, patent_title, search_count, last_searched_at)
  VALUES (p_patent_number, p_patent_title, 1, now())
  ON CONFLICT (patent_number)
  DO UPDATE SET
    search_count = public.patent_search_stats.search_count + 1,
    last_searched_at = now(),
    patent_title = COALESCE(EXCLUDED.patent_title, public.patent_search_stats.patent_title);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
