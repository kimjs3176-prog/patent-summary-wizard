-- 2026-10-31 공개 접근 최소화 (서비스 전반 보안 점검 후속)
--
-- 1) site_settings: 비밀값 성격의 키는 익명 읽기에서 제외한다.
--    (관리자 화면이 KIPRIS 키를 이 테이블에 저장해 왔고, 홈 화면은 테이블 전체를 읽는다.)
--    비밀값은 Edge Function Secret(KIPRIS_API_KEY)으로만 관리하고, 서버는 서비스 롤로 읽는다.
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read public site settings" ON public.site_settings
  FOR SELECT USING (
    key <> 'kipris_api_key'
    AND key NOT LIKE '%api\_key%'
    AND key NOT LIKE '%secret%'
    AND key NOT LIKE '%password%'
  );

-- 2) 요청 제한 저장소를 증가 없이 조회하는 함수 (관리자 인증 실패 횟수 확인용)
CREATE OR REPLACE FUNCTION public.peek_rate_limit(
  _bucket TEXT,
  _identifier TEXT,
  _limit INTEGER,
  _window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start TIMESTAMPTZ;
  _count INTEGER;
BEGIN
  _window_start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  SELECT request_count INTO _count
  FROM public.edge_rate_limits
  WHERE bucket = _bucket AND identifier = _identifier AND window_start = _window_start;
  RETURN coalesce(_count, 0) < _limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.peek_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peek_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- 3) 만족도 자유 입력 코멘트(개인정보 가능)는 관리자 함수(서비스 롤)에서만 읽는다.
REVOKE EXECUTE ON FUNCTION public.get_satisfaction_comments(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_satisfaction_comments(integer) TO service_role;

-- 4) 익명 RPC 입력 검증: 인기 검색 집계는 특허번호 형식일 때만, 제목은 200자까지만 기록한다.
CREATE OR REPLACE FUNCTION public.upsert_search_stat(p_patent_number TEXT, p_patent_title TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _number TEXT := btrim(coalesce(p_patent_number, ''));
  _title TEXT := NULLIF(left(btrim(coalesce(p_patent_title, '')), 200), '');
BEGIN
  -- 10-2021-0162560 / 10-2456789 / 하이픈 없는 숫자열(9~13자리)만 허용
  IF _number !~ '^[0-9]{2}-?([0-9]{4}-?)?[0-9]{7}$' THEN
    RAISE EXCEPTION 'invalid patent number';
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
  VALUES (NULLIF(left(btrim(coalesce(p_patent_number, '')), 50), ''), p_rating, NULLIF(left(coalesce(p_comment, ''), 500), ''));
END;
$$;

-- 5) 어떤 화면도 쓰지 않는 테이블의 익명 권한 회수 (테이블 삭제는 데이터 확인 후 별도 진행)
DO $$
BEGIN
  IF to_regclass('public.highlight_rule_proposals') IS NOT NULL THEN
    DROP POLICY IF EXISTS "read approved" ON public.highlight_rule_proposals;
    DROP POLICY IF EXISTS "propose insert" ON public.highlight_rule_proposals;
    REVOKE ALL ON public.highlight_rule_proposals FROM anon, authenticated;
  END IF;
  IF to_regclass('public.product_image_cache') IS NOT NULL THEN
    REVOKE ALL ON public.product_image_cache FROM anon, authenticated;
  END IF;
  IF to_regclass('public.rda_patents_cache') IS NOT NULL THEN
    REVOKE ALL ON public.rda_patents_cache FROM anon, authenticated;
  END IF;
  IF to_regclass('public.patent_search_events') IS NOT NULL THEN
    REVOKE SELECT ON public.patent_search_events FROM anon, authenticated;
  END IF;
END $$;
