-- Fix PUBLIC_DATA_EXPOSURE: Remove overly permissive INSERT/UPDATE policies
-- Keep only SELECT for public read access
-- Writes will go through the SECURITY DEFINER upsert_search_stat function only

DROP POLICY IF EXISTS "Anyone can insert search stats" ON public.patent_search_stats;
DROP POLICY IF EXISTS "Anyone can update search stats" ON public.patent_search_stats;

-- Explicitly deny DELETE
CREATE POLICY "Deny public delete" ON public.patent_search_stats FOR DELETE USING (false);
