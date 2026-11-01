-- 시장 표준값(market_reference) 신뢰 수준과 점수 캐시 규칙 버전.
-- official  : KOSIS 등 국가통계에서 자동으로 가져온 값
-- approved  : 관리자가 출처를 확인해 승인한 값
-- ai_pending: AI가 쓴 값(출처 미확인). 같은 시장의 수치를 일정하게 유지하는 데만 쓰고, 출처를 붙이지 않는다.
ALTER TABLE public.market_reference
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ai_pending',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'market_reference_status_check' AND conrelid = 'public.market_reference'::regclass
  ) THEN
    ALTER TABLE public.market_reference
      ADD CONSTRAINT market_reference_status_check CHECK (status IN ('official', 'approved', 'ai_pending'));
  END IF;
END $$;

-- KOSIS(summarize-patent/kosis.ts)에서 온 행만 공식값으로 올린다. 나머지는 ai_pending 그대로 둔다.
UPDATE public.market_reference
SET status = 'official',
    source_url = COALESCE(source_url, 'https://kosis.kr'),
    verified_at = COALESCE(verified_at, created_at)
WHERE source ILIKE '%KOSIS%' OR source LIKE '%통계청%';

-- 예전 글로벌 행에 표식으로 넣던 'USD'는 출처가 아니므로 지운다.
UPDATE public.market_reference SET source = NULL WHERE source = 'USD' AND status = 'ai_pending';

CREATE INDEX IF NOT EXISTS idx_market_reference_status ON public.market_reference (status, created_at DESC);

-- 점수 캐시: 행을 쓰거나 갱신한 점수 규칙 버전. 기존 행은 NULL로 두고 다시 계산하지 않는다.
ALTER TABLE public.patent_score_cache
  ADD COLUMN IF NOT EXISTS score_version text;

-- RLS·권한은 그대로(market_reference는 service_role 전용).
