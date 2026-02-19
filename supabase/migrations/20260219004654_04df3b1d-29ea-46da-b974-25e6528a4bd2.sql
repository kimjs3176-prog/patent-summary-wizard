
-- Site settings table for homepage customization
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "No public insert" ON public.site_settings FOR INSERT WITH CHECK (false);
CREATE POLICY "No public update" ON public.site_settings FOR UPDATE USING (false);
CREATE POLICY "No public delete" ON public.site_settings FOR DELETE USING (false);

-- Insert default settings
INSERT INTO public.site_settings (key, value) VALUES
  ('hero_title', '농식품분야 특허'),
  ('hero_title_accent', 'AI 기술요약'),
  ('hero_title_suffix', '서비스'),
  ('hero_description', '농식품 분야 특허를 AI가 자동으로 분석하고 요약합니다'),
  ('header_title', '농식품분야 특허 AI 기술요약'),
  ('header_subtitle', 'Agri-Food Patent AI Summary'),
  ('footer_line1', '본 서비스는 지식재산처/한국특허정보원의 공공데이터를 활용하여 제작되었습니다'),
  ('footer_line2', 'KIPRIS(한국특허정보원) 데이터 연동 · AI 기반 특허 분석'),
  ('primary_color', '#00aba2'),
  ('featured_section_title', '이달의 특허 · 기술이전 추천'),
  ('featured_section_subtitle', '농식품 분야 기술이전 추천 특허');
