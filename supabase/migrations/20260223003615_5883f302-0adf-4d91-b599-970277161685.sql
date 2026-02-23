
-- Cache for AI patent summaries (both summary and detailed modes)
CREATE TABLE public.patent_ai_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patent_number TEXT NOT NULL,
  analysis_mode TEXT NOT NULL DEFAULT 'summary',
  summary_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patent_number, analysis_mode)
);

-- Cache for commercialization scores
CREATE TABLE public.patent_score_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patent_number TEXT NOT NULL UNIQUE,
  total_score INTEGER NOT NULL,
  technology_score INTEGER NOT NULL,
  market_score INTEGER NOT NULL,
  business_score INTEGER NOT NULL,
  trl INTEGER NOT NULL DEFAULT 5,
  trl_reason TEXT,
  analysis TEXT,
  technology_reason TEXT,
  market_reason TEXT,
  business_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patent_ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patent_score_cache ENABLE ROW LEVEL SECURITY;

-- Public read/write for anonymous access (service uses anon key)
CREATE POLICY "Allow public read on patent_ai_cache" ON public.patent_ai_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert on patent_ai_cache" ON public.patent_ai_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read on patent_score_cache" ON public.patent_score_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert on patent_score_cache" ON public.patent_score_cache FOR INSERT WITH CHECK (true);

-- Indexes for fast lookups
CREATE INDEX idx_patent_ai_cache_lookup ON public.patent_ai_cache(patent_number, analysis_mode);
CREATE INDEX idx_patent_score_cache_lookup ON public.patent_score_cache(patent_number);
