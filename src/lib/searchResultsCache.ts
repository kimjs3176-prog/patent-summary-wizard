import type { SearchResultRow } from "@/components/search/searchFilters";

/**
 * 검색 결과 화면에서 요약서를 열었다가 '뒤로' 오면, 같은 결과·같은 쪽·같은 스크롤 위치로 돌아오게 한다.
 * 결과는 이 탭에서만 잠시 기억해(새로고침하면 사라짐) 같은 검색을 서버에 다시 보내지 않는다.
 */
export interface CachedSearch {
  patents: SearchResultRow[];
  totalCount: number;
  extractedKeywords: string[];
  intent: string;
  dropped: number;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 20;
const results = new Map<string, { at: number; data: CachedSearch }>();
const scrolls = new Map<string, number>();

export const searchCacheKey = (keyword: string, fieldId: string) => `${fieldId}\u0000${keyword}`;

export function readSearchCache(key: string, now = Date.now()): CachedSearch | null {
  const hit = results.get(key);
  if (!hit) return null;
  if (now - hit.at > TTL_MS) {
    results.delete(key);
    return null;
  }
  return hit.data;
}

/** 결과가 있는 검색만 기억한다 (0건·실패는 다시 찾아보게 둔다). */
export function writeSearchCache(key: string, data: CachedSearch, now = Date.now()) {
  if (data.patents.length === 0) return;
  results.delete(key);
  results.set(key, { at: now, data });
  while (results.size > MAX_ENTRIES) {
    const oldest = results.keys().next().value;
    if (oldest === undefined) break;
    results.delete(oldest);
  }
}

export function clearSearchCache() {
  results.clear();
  scrolls.clear();
}

/** 주소의 ?page= 를 쪽 번호로 (없거나 이상하면 1쪽) */
export function pageFromParam(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/** 방문 기록 한 칸(location.key)마다 떠날 때의 스크롤 위치 */
export const rememberScroll = (locationKey: string, y: number) => {
  scrolls.set(locationKey, Math.max(0, Math.round(y)));
};
export const recallScroll = (locationKey: string): number | undefined => scrolls.get(locationKey);
