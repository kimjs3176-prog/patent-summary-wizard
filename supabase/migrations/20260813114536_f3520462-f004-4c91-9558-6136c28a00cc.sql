UPDATE public.site_settings SET value='Agri IP Summary (AIS)' WHERE key='header_title';
UPDATE public.site_settings SET value='농식품분야 특허 AI 기술분석 서비스' WHERE key='header_subtitle';
UPDATE public.site_settings SET value='Agri IP' WHERE key='hero_title';
UPDATE public.site_settings SET value='Summary' WHERE key='hero_title_accent';
UPDATE public.site_settings SET value='(AIS)' WHERE key='hero_title_suffix';
UPDATE public.site_settings SET value=replace(replace(value,'농식품 특허 요약서','Agri IP Summary (AIS) 특허 요약서'),'농식품 특허 요약 서비스','Agri IP Summary (AIS)') WHERE key='pdf_layout_config';