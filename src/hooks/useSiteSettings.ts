import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = Record<string, string>;

const DEFAULT_SETTINGS: SiteSettings = {
  hero_title: "Agri IP",
  hero_title_accent: "Summary",
  hero_title_suffix: "(AIS)",
  hero_description: "농식품 분야 특허를 AI가 분석하고 요약정보를 제공합니다",
  header_title: "Agri IP Summary (AIS)",
  header_subtitle: "농식품분야 특허 AI 기술분석 서비스",
  footer_line1: "본 서비스는 KIPRIS(한국특허정보원) 공공데이터를 활용하여 AI 서비스 LOVABLE을 통해 제작되었습니다",
  footer_line2: "Copyright 2026. KOAT. All rights reserved.",
  primary_color: "#00aba2",
  accent_color: "#3b82f6",
  featured_section_title: "이달의 특허 · 기술이전 추천",
  featured_section_subtitle: "농식품 분야 기술이전 추천 특허",
  feature_pdf: "true",
  feature_favorites: "true",
  feature_search_history: "true",
  feature_glossary: "true",
  feature_filing: "true",
  filing_url: "/filing-app/",
  homepage_visible_sections: "",
  summary_disclaimer: "※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음",
  summary_section_titles: "",
  summary_visible_sections: "",
  summary_ai_prompt_extra: "",
  summary_card_icons: "",
  summary_info_labels: "",
  summary_max_tokens: "3000",
  summary_section_lengths: "",
  search_placeholder: "관심있는 기술의 키워드, 특허명칭, 출원번호나 등록번호를 입력하세요",
  search_helper_text: "관심있는 키워드나 특허 등록번호(예: 10-2920574)/출원번호(예:10-2022-1213421)를 입력하세요",
  search_helper_texts: "",
  score_settings: "",
  trl_settings: "",
  pdf_layout_config: "",
  print_sections: "",
  ai_model: "google/gemini-3.6-flash",
  video_categories: "[]",
};

// Shared cache to prevent multiple fetches
let cachedSettings: SiteSettings | null = null;

// Last fetched settings, kept in the browser so returning visitors see the
// page at once (no blank loading screen) while fresh values load in the background.
const SNAPSHOT_KEY = "site-settings-snapshot-v1";
const snapshot: SiteSettings | null = (() => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...DEFAULT_SETTINGS, ...parsed } : null;
  } catch {
    return null;
  }
})();
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
        try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(map)); } catch { /* ignore */ }
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

// Start loading as soon as the app code runs, in parallel with the first render.
if (typeof window !== "undefined") void fetchSettings();

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cachedSettings || snapshot || DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(!cachedSettings && !snapshot);

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
