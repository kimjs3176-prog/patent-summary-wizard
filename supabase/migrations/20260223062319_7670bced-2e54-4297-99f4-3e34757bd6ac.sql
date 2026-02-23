
-- KIPRIS 특허 원본 데이터 캐시 테이블
CREATE TABLE public.patent_data_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patent_number TEXT NOT NULL,
  patent_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_patents JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- patent_number에 유니크 인덱스
CREATE UNIQUE INDEX idx_patent_data_cache_number ON public.patent_data_cache (patent_number);

-- RLS 활성화
ALTER TABLE public.patent_data_cache ENABLE ROW LEVEL SECURITY;

-- 읽기 허용
CREATE POLICY "Allow public read on patent_data_cache"
ON public.patent_data_cache
FOR SELECT
USING (true);

-- 삽입 허용 (edge function에서 service role로 삽입하지만, anon도 허용)
CREATE POLICY "Allow public insert on patent_data_cache"
ON public.patent_data_cache
FOR INSERT
WITH CHECK (true);
