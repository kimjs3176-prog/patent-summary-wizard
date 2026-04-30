import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = Record<string, string>;

const DEFAULT_SETTINGS: SiteSettings = {
  hero_title: "농식품분야 특허",
  hero_title_accent: "AI 기술요약",
  hero_title_suffix: "서비스",
  hero_description: "농식품 분야 특허를 AI가 자동으로 분석하고 요약합니다",
  header_title: "농식품분야 특허 AI 기술분석(V1.1)",
  header_subtitle: "Agri-Food Patent AI Summary",
  footer_line1: "본 서비스는 지식재산처/한국특허정보원의 공공데이터를 활용하여 제작되었습니다",
  footer_line2: "KIPRIS(한국특허정보원) 데이터 연동 · AI 기반 특허 분석",
  primary_color: "#00aba2",
  accent_color: "#3b82f6",
  featured_section_title: "이달의 특허 · 기술이전 추천",
  featured_section_subtitle: "농식품 분야 기술이전 추천 특허",
  feature_pdf: "true",
  feature_ppt: "true",
  feature_favorites: "true",
  feature_search_history: "true",
  feature_glossary: "true",
  feature_competitor_analysis: "true",
  homepage_visible_sections: "",
  summary_disclaimer: "※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음",
  summary_section_titles: "",
  summary_visible_sections: "",
  summary_ai_prompt_extra: "",
  summary_card_icons: "",
  summary_info_labels: "",
  summary_max_tokens: "3000",
  summary_section_lengths: "",
  search_placeholder: "관심 키워드 또는 특허 등록번호, 출원번호를 입력하세요",
  search_helper_text: "관심있는 키워드나 특허 등록번호(예: 10-2920574)/출원번호(예:10-2022-1213421)를 입력하세요",
  search_helper_texts: "",
  score_settings: "",
  trl_settings: "",
  pdf_layout_config: "",
  print_sections: "",
  chatbot_title: "Patent Chat Aid",
  chatbot_width: "440",
  chatbot_height: "92",
  chatbot_visible: "true",
  ai_model: "google/gemini-2.5-flash",
};

// Shared cache to prevent multiple fetches
let cachedSettings: SiteSettings | null = null;
let fetchPromise: Promise<SiteSettings> | null = null;

async function fetchSettings(): Promise<SiteSettings> {
  if (cachedSettings) return cachedSettings;
  if (fetchPromise) return fetchPromise;
  
  fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");
      if (!error && data) {
        const map: SiteSettings = { ...DEFAULT_SETTINGS };
        for (const row of data) {
          if (row.key && row.value) map[row.key] = row.value;
        }
        cachedSettings = map;
        return map;
      }
    } catch {
      // use defaults
    }
    cachedSettings = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  })();
  
  return fetchPromise;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cachedSettings || DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(!cachedSettings);

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      setIsLoading(false);
      return;
    }
    fetchSettings().then((s) => {
      setSettings(s);
      setIsLoading(false);
    });
  }, []);

  return { settings, isLoading };
}
