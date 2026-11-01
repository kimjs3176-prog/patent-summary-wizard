import { BarChart3, Compass, FileSignature, Gift, Heart, Home, Layers, PlayCircle, type LucideIcon } from "lucide-react";
import { filingEnabled, type SettingsLike } from "@/lib/filing";

/**
 * One list of everything the site offers. The header menu, the mobile menu panel and the home
 * "서비스 바로가기" cards all read from here, so a service is named and described the same way everywhere.
 */
export type ServiceKey = "home" | "finder" | "filing" | "potential" | "insights" | "batch" | "favorites" | "videos";
export type ServiceGroup = "find" | "prepare" | "mine";

export interface ServiceItem {
  key: ServiceKey;
  to: string;
  /** Short label for the header menu. */
  label: string;
  /** Full name for cards and the menu panel. */
  title: string;
  description: string;
  icon: LucideIcon;
  group: ServiceGroup;
  /** Shown directly in the desktop header; the rest sit under 더보기. */
  primary: boolean;
  /** Shown as a card on the home page (the home page itself and the video section are already there). */
  homeCard: boolean;
}

export const SERVICE_GROUP_LABEL: Record<ServiceGroup, string> = {
  find: "특허 찾기",
  prepare: "준비와 분석",
  mine: "내 목록과 자료",
};

export const SERVICES: ServiceItem[] = [
  { key: "home", to: "/", label: "홈", title: "통합검색", description: "키워드, 문장, 질문 모두 검색창 하나로 찾아요", icon: Home, group: "find", primary: true, homeCard: false },
  { key: "finder", to: "/finder", label: "나만의 특허찾기", title: "나만의 특허찾기", description: "업종과 아이템을 알려 주면 맞는 특허를 추천해요", icon: Compass, group: "find", primary: true, homeCard: true },
  { key: "potential", to: "/potential", label: "무상기술이전", title: "무상기술이전", description: "무상으로 이전받을 수 있는 특허를 모아 봤어요", icon: Gift, group: "find", primary: true, homeCard: true },
  { key: "filing", to: "/filing", label: "출원도우미", title: "출원도우미", description: "아이디어부터 명세서 초안까지 단계별로 도와요", icon: FileSignature, group: "prepare", primary: true, homeCard: true },
  { key: "insights", to: "/insights", label: "인사이트", title: "특허 인사이트", description: "연도별, 분야별 출원 동향을 한눈에 봐요", icon: BarChart3, group: "prepare", primary: true, homeCard: true },
  { key: "batch", to: "/batch", label: "일괄조회", title: "일괄조회·다운로드", description: "여러 특허를 한 번에 조회하고 엑셀로 받아요", icon: Layers, group: "prepare", primary: false, homeCard: true },
  { key: "favorites", to: "/compare", label: "관심특허", title: "관심특허", description: "담아 둔 특허를 모아 보고 나란히 비교해요", icon: Heart, group: "mine", primary: false, homeCard: true },
  { key: "videos", to: "/tech-videos", label: "기술소개영상", title: "기술소개영상", description: "농식품 주요 기술을 영상으로 살펴봐요", icon: PlayCircle, group: "mine", primary: false, homeCard: false },
];

/** Services this site currently offers: 출원도우미 follows the feature_filing setting like its other entry points. */
export function visibleServices(settings: SettingsLike): ServiceItem[] {
  const filing = filingEnabled(settings);
  return SERVICES.filter((s) => s.key !== "filing" || filing);
}

/** The home entry also covers search results, which are reached from its search box. */
export function isServiceActive(item: ServiceItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/" || pathname === "/search";
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
