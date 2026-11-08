import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSearchCache, pageFromParam, readSearchCache, recallScroll, rememberScroll, searchCacheKey, writeSearchCache,
  type CachedSearch,
} from "@/lib/searchResultsCache";

const found = (n: number): CachedSearch => ({
  patents: Array.from({ length: n }, (_, i) => ({ patentId: `10-20800${i}`, title: `특허 ${i}` })) as CachedSearch["patents"],
  totalCount: n,
  extractedKeywords: ["발효"],
  intent: "",
  dropped: 0,
});

describe("검색 결과로 돌아오기", () => {
  beforeEach(() => clearSearchCache());

  it("같은 검색어·분야는 기억해 둔 결과를 다시 쓴다 (서버에 다시 보내지 않음)", () => {
    const key = searchCacheKey("발효", "");
    writeSearchCache(key, found(43), 1_000);
    expect(readSearchCache(key, 2_000)?.totalCount).toBe(43);
    expect(readSearchCache(searchCacheKey("발효", "food"), 2_000)).toBeNull();
  });

  it("0건은 기억하지 않고, 10분이 지나면 다시 찾는다", () => {
    const key = searchCacheKey("없는말", "");
    writeSearchCache(key, found(0), 1_000);
    expect(readSearchCache(key, 2_000)).toBeNull();
    writeSearchCache(searchCacheKey("발효", ""), found(3), 0);
    expect(readSearchCache(searchCacheKey("발효", ""), 10 * 60 * 1000 + 1)).toBeNull();
  });

  it("쪽 번호는 주소에서 읽고, 이상한 값은 1쪽", () => {
    expect(pageFromParam("3")).toBe(3);
    for (const raw of [null, "", "0", "-2", "1.5", "abc"]) expect(pageFromParam(raw)).toBe(1);
  });

  it("방문 기록 칸마다 떠날 때의 스크롤 위치를 기억한다", () => {
    rememberScroll("k1", 1021.6);
    expect(recallScroll("k1")).toBe(1022);
    expect(recallScroll("k2")).toBeUndefined();
  });
});
