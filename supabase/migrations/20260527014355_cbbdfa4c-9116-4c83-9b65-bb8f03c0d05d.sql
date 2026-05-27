
DROP POLICY IF EXISTS "Allow public insert on patent_ai_cache" ON public.patent_ai_cache;
CREATE POLICY "Deny public insert on patent_ai_cache" ON public.patent_ai_cache FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "Deny public update on patent_ai_cache" ON public.patent_ai_cache FOR UPDATE TO public USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete on patent_ai_cache" ON public.patent_ai_cache FOR DELETE TO public USING (false);

DROP POLICY IF EXISTS "Allow public insert on patent_data_cache" ON public.patent_data_cache;
CREATE POLICY "Deny public insert on patent_data_cache" ON public.patent_data_cache FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "Deny public update on patent_data_cache" ON public.patent_data_cache FOR UPDATE TO public USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete on patent_data_cache" ON public.patent_data_cache FOR DELETE TO public USING (false);

DROP POLICY IF EXISTS "Allow public insert on patent_score_cache" ON public.patent_score_cache;
CREATE POLICY "Deny public insert on patent_score_cache" ON public.patent_score_cache FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "Deny public update on patent_score_cache" ON public.patent_score_cache FOR UPDATE TO public USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete on patent_score_cache" ON public.patent_score_cache FOR DELETE TO public USING (false);

CREATE POLICY "Deny public insert on patent_search_stats" ON public.patent_search_stats FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "Deny public update on patent_search_stats" ON public.patent_search_stats FOR UPDATE TO public USING (false) WITH CHECK (false);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Deny public select on bucket 111') THEN
    CREATE POLICY "Deny public select on bucket 111" ON storage.objects FOR SELECT TO public USING (bucket_id <> '111');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Deny public insert on bucket 111') THEN
    CREATE POLICY "Deny public insert on bucket 111" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id <> '111');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Deny public update on bucket 111') THEN
    CREATE POLICY "Deny public update on bucket 111" ON storage.objects FOR UPDATE TO public USING (bucket_id <> '111') WITH CHECK (bucket_id <> '111');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Deny public delete on bucket 111') THEN
    CREATE POLICY "Deny public delete on bucket 111" ON storage.objects FOR DELETE TO public USING (bucket_id <> '111');
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_search_stat(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_search_stat(text, text) TO anon, authenticated, service_role;
