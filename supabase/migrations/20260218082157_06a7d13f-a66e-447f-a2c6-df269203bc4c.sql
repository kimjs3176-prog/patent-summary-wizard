
-- RDA 특허 캐시 테이블
CREATE TABLE public.rda_patents_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  patents jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rda_patents_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cache" ON public.rda_patents_cache FOR SELECT USING (true);
CREATE POLICY "No public insert" ON public.rda_patents_cache FOR INSERT WITH CHECK (false);
CREATE POLICY "No public update" ON public.rda_patents_cache FOR UPDATE USING (false);
CREATE POLICY "No public delete" ON public.rda_patents_cache FOR DELETE USING (false);

CREATE UNIQUE INDEX idx_rda_cache_category ON public.rda_patents_cache (category);

-- 이달의 특허 (기술이전 추천특허) 테이블
CREATE TABLE public.featured_patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_number text NOT NULL,
  title text NOT NULL,
  description text,
  recommendation_reason text,
  category text,
  transfer_status text DEFAULT '기술이전 가능',
  contact_info text,
  thumbnail_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_patents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active featured patents" ON public.featured_patents FOR SELECT USING (true);
CREATE POLICY "No public insert" ON public.featured_patents FOR INSERT WITH CHECK (false);
CREATE POLICY "No public update" ON public.featured_patents FOR UPDATE USING (false);
CREATE POLICY "No public delete" ON public.featured_patents FOR DELETE USING (false);

CREATE INDEX idx_featured_active ON public.featured_patents (is_active, display_order);
