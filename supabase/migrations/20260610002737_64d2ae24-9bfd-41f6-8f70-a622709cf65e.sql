ALTER TABLE public.patent_data_cache ADD COLUMN IF NOT EXISTS cache_version TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE public.patent_ai_cache ADD COLUMN IF NOT EXISTS cache_version TEXT NOT NULL DEFAULT 'v1';
CREATE INDEX IF NOT EXISTS patent_data_cache_version_idx ON public.patent_data_cache(patent_number, cache_version);
CREATE INDEX IF NOT EXISTS patent_ai_cache_version_idx ON public.patent_ai_cache(patent_number, analysis_mode, cache_version);