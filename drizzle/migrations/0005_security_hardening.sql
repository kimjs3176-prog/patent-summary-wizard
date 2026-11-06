-- 2026-11-06 보안 점검 후속
--
-- 1) 인기 검색 집계: 화면이 보낸 제목은 쓰지 않는다.
--    누구나 부를 수 있는 함수라, 제목을 그대로 받으면 홈 인기 검색 목록의 제목을 아무 글로나 바꿀 수 있었다.
--    서버가 KIPRIS에서 받아 둔 원문(patent_data_cache)의 제목만 쓰고, 원문이 없는 번호(서버가 조회한 적 없는 번호)는 세지 않는다.
--    같은 번호는 30초에 한 번만 세어 반복 호출로 순위를 끌어올리기 어렵게 한다.
CREATE OR REPLACE FUNCTION public.upsert_search_stat(p_patent_number TEXT, p_patent_title TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _number TEXT := btrim(coalesce(p_patent_number, ''));
  _digits TEXT;
  _title TEXT;
BEGIN
  -- 10-2021-0162560 / 10-2456789 / 하이픈 없는 숫자열(9~13자리)만 허용
  IF _number !~ '^[0-9]{2}-?([0-9]{4}-?)?[0-9]{7}$' THEN
    RAISE EXCEPTION 'invalid patent number';
  END IF;
  _digits := regexp_replace(_number, '[^0-9]', '', 'g');

  SELECT NULLIF(left(btrim(coalesce(c.patent_data->>'titleKo', c.patent_data->>'title', '')), 200), '')
    INTO _title
    FROM public.patent_data_cache c
   WHERE c.patent_number = _number OR regexp_replace(c.patent_number, '[^0-9]', '', 'g') = _digits
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.patent_search_events e
     WHERE e.patent_number = _number AND e.searched_at > now() - interval '30 seconds'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.patent_search_stats (patent_number, patent_title, search_count, last_searched_at)
  VALUES (_number, _title, 1, now())
  ON CONFLICT (patent_number) DO UPDATE SET
    search_count = public.patent_search_stats.search_count + 1,
    last_searched_at = now(),
    patent_title = COALESCE(EXCLUDED.patent_title, public.patent_search_stats.patent_title);

  INSERT INTO public.patent_search_events (patent_number, patent_title)
  VALUES (_number, _title);
END;
$$;

-- 2) 비밀값 성격의 설정 키: 서버 판단(_shared/kipris.ts isSecretSettingKey)과 같게 대소문자를 가리지 않고 막는다.
--    예전에 관리자 화면이 저장해 둔 키 값은 지운다 (비밀값은 Edge Function Secret 에만 둔다).
DELETE FROM public.site_settings WHERE key ~* '(api_key|secret|password)';
DROP POLICY IF EXISTS "Anyone can read public site settings" ON public.site_settings;
CREATE POLICY "Anyone can read public site settings" ON public.site_settings
  FOR SELECT USING (key !~* '(api_key|secret|password)');

-- 3) 이번 달 인기 검색: 한 번에 돌려주는 개수를 20개로 제한한다
CREATE OR REPLACE FUNCTION public.get_monthly_popular_searches(p_limit INT DEFAULT 6)
RETURNS TABLE (patent_number TEXT, patent_title TEXT, search_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.patent_number,
    (ARRAY_AGG(e.patent_title ORDER BY e.searched_at DESC) FILTER (WHERE e.patent_title IS NOT NULL))[1] AS patent_title,
    COUNT(*)::BIGINT AS search_count
  FROM public.patent_search_events e
  WHERE e.searched_at >= date_trunc('month', now())
  GROUP BY e.patent_number
  ORDER BY search_count DESC, MAX(e.searched_at) DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 6), 1), 20);
$$;
GRANT EXECUTE ON FUNCTION public.get_monthly_popular_searches(INT) TO anon, authenticated;

-- 4) 이미 쌓인 제목도 서버 원문 제목으로 바로잡는다 (원문이 있는 번호만)
UPDATE public.patent_search_stats s
   SET patent_title = NULLIF(left(btrim(coalesce(c.patent_data->>'titleKo', c.patent_data->>'title', '')), 200), '')
  FROM public.patent_data_cache c
 WHERE c.patent_number = s.patent_number;
UPDATE public.patent_search_events e
   SET patent_title = NULLIF(left(btrim(coalesce(c.patent_data->>'titleKo', c.patent_data->>'title', '')), 200), '')
  FROM public.patent_data_cache c
 WHERE c.patent_number = e.patent_number AND e.searched_at >= date_trunc('month', now());

-- 5) 숨긴(비활성) 추천 특허·공지는 공개 화면에서 읽지 못하게 한다 (담당자 연락처 등). 관리자 화면은 서비스 롤로 읽는다.
DROP POLICY IF EXISTS "Anyone can read active featured patents" ON public.featured_patents;
CREATE POLICY "Anyone can read active featured patents" ON public.featured_patents FOR SELECT USING (is_active);
DROP POLICY IF EXISTS "Anyone can read active notices" ON public.notices;
CREATE POLICY "Anyone can read active notices" ON public.notices FOR SELECT USING (is_active);

-- 6) 기술소개 영상(tech-videos 버킷): 공개 읽기만 남긴다.
--    올리기·지우기는 관리자 함수(manage-featured-patents)가 비밀번호를 확인한 뒤 서비스 롤로 하고,
--    업로드는 그 함수가 내준 한 번 쓰는 서명 주소로만 한다. 그래서 익명 쓰기 정책은 이름과 상관없이 지운다
--    (이 버킷을 가리키는 쓰기 정책, 그리고 버킷 조건 없이 모든 버킷에 쓰기를 여는 정책).
DROP POLICY IF EXISTS "Public insert tech-videos" ON storage.objects;
DROP POLICY IF EXISTS "Public update tech-videos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete tech-videos" ON storage.objects;
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
       AND (
         (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%tech-videos%'
         OR ((coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%bucket_id%' AND roles && ARRAY['anon', 'public']::name[])
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;
