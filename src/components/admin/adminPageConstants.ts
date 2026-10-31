export interface FeaturedPatent {
id: string;
patent_number: string;
title: string;
description: string | null;
recommendation_reason: string | null;
category: string | null;
transfer_status: string | null;
contact_info: string | null;
thumbnail_url: string | null;
display_order: number;
is_active: boolean;
created_at: string;
updated_at: string;
}

export const DEFAULT_CATEGORY_OPTIONS = ["기계설비용품", "기능성소재", "식품", "재배생육", "환경·에너지", "기타", "잠재기술"];

export const EMPTY_FORM = {
patent_number: "",
title: "",
description: "",
recommendation_reason: "",
category: "",
transfer_status: "기술이전 가능",
contact_info: "",
thumbnail_url: "",
display_order: 0,
is_active: true,
};

export type SiteSettings = Record<string, string>;

export interface CacheItem {
id: string;
patent_number: string;
created_at: string;
}

export interface CacheCounts {
data: number;
ai: number;
score: number;
}


export const SETTINGS_FIELDS = [
{ key: "header_title", label: "헤더 타이틀", placeholder: "Agri IP Summary (AIS)" },
{ key: "header_subtitle", label: "헤더 서브타이틀", placeholder: "농식품분야 특허 AI 기술분석 서비스" },
{ key: "hero_title", label: "히어로 타이틀 1줄", placeholder: "Agri IP" },
{ key: "hero_title_accent", label: "히어로 강조 텍스트", placeholder: "Summary" },
{ key: "hero_title_suffix", label: "히어로 타이틀 끝", placeholder: "(AIS)" },
{ key: "hero_description", label: "히어로 설명", placeholder: "농식품 분야 특허를 AI가 자동으로 분석하고 요약합니다" },
{ key: "featured_section_title", label: "이달의 특허 섹션 제목", placeholder: "이달의 특허 · 기술이전 추천" },
{ key: "featured_section_subtitle", label: "이달의 특허 섹션 부제목", placeholder: "농식품 분야 기술이전 추천 특허" },
{ key: "footer_line1", label: "푸터 1줄", placeholder: "본 서비스는..." },
{ key: "footer_line2", label: "푸터 2줄", placeholder: "KIPRIS 데이터 연동..." },
{ key: "search_placeholder", label: "검색창 예시 텍스트", placeholder: "관심 키워드 또는 특허 등록번호, 출원번호를 입력하세요" },
{ key: "search_helper_text", label: "검색창 안내 텍스트", placeholder: "관심있는 키워드나 특허 등록번호(예: 10-2920574)/출원번호(예:10-2022-1213421)를 입력하세요" },
{ key: "filing_url", label: "출원지원 주소 — 비우면 이 사이트 안의 /filing-app/ (바깥 서버를 쓰려면 https 주소)", placeholder: "/filing-app/" },
];

export const DEFAULT_HOMEPAGE_SECTIONS: Record<string, boolean> = {
  featuredPatents: true,
  techVideos: true,
  techTransferGuide: true,
  popularSearches: true,
};

export const DEFAULT_SECTION_TITLES: Record<string, string> = {
  "기술분야": "기술분야",
  "발명요약 및 특징": "발명요약 및 특징",
  "관련시장 동향": "관련시장 동향",
  "농산업활용 가능성": "농산업활용 가능성",
  "상용화전망": "상용화전망",
};
export const DEFAULT_SECTION_LENGTHS: Record<string, number> = {
  "기술분야": 3,
  "발명요약 및 특징": 6,
  "관련시장 동향": 5,
  "농산업활용 가능성": 4,
  "상용화전망": 4,
};
export const DEFAULT_VISIBLE_SECTIONS: Record<string, boolean> = {
  commercialization: true,
  claims: true,
  familyTree: true,
};
export const DEFAULT_CARD_ICONS: Record<string, string> = {
  patentInfo: "📄",
  aiSummary: "🤖",
  claims: "📑",
};
export const DEFAULT_PRINT_SECTIONS: Record<string, boolean> = {
  patentInfo: true,
  commercialization: true,
  aiSummary: true,
  trl: true,
  claims: false,
  relatedPatents: false,
  disclaimer: true,
  header: true,
  footer: true,
};
export const DEFAULT_INFO_LABELS: Record<string, string> = {
  registrationNumber: "등록번호",
  applicationNumber: "출원번호",
  assignee: "출원인",
  filingDate: "출원일",
  publicationDate: "등록일",
  ipc: "IPC",
};
