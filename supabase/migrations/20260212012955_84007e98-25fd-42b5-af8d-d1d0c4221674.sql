
CREATE OR REPLACE FUNCTION public.upsert_search_stat(p_patent_number text, p_patent_title text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate patent number format and length
  IF p_patent_number IS NULL OR length(trim(p_patent_number)) = 0 THEN
    RAISE EXCEPTION 'patent_number required';
  END IF;
  
  IF length(p_patent_number) > 50 OR NOT p_patent_number ~ '^[0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid patent_number format';
  END IF;
  
  -- Limit title length
  IF p_patent_title IS NOT NULL AND length(p_patent_title) > 500 THEN
    p_patent_title := substring(p_patent_title, 1, 500);
  END IF;

  INSERT INTO public.patent_search_stats (patent_number, patent_title, search_count, last_searched_at)
  VALUES (p_patent_number, p_patent_title, 1, now())
  ON CONFLICT (patent_number)
  DO UPDATE SET
    search_count = public.patent_search_stats.search_count + 1,
    last_searched_at = now(),
    patent_title = COALESCE(EXCLUDED.patent_title, public.patent_search_stats.patent_title);
END;
$function$;
