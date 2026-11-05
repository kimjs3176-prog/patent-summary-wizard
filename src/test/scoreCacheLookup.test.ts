import { describe, it, expect, vi } from "vitest";
import { chunk, lookupCachedScores, registrationShortForm, scoreFor, scoreKey, scoreKeyVariants, type ScoreCacheRow } from "@/lib/scoreCacheLookup";

describe("사업화점수 캐시 키", () => {
  it("숫자만 / 하이픈 형식을 모두 조회한다", () => {
    expect(scoreKeyVariants("10-2021-0162560")).toEqual(["1020210162560", "10-2021-0162560"]);
    expect(scoreKeyVariants("1020210162560")).toEqual(["1020210162560", "10-2021-0162560"]);
    expect(scoreKeyVariants("10-2456789")).toEqual(["102456789", "10-2456789"]);
    expect(scoreKeyVariants(" 102456789 ")).toEqual(["102456789", "10-2456789"]);
  });

  it("번호가 아니면 조회하지 않는다", () => {
    expect(scoreKeyVariants("")).toEqual([]);
    expect(scoreKeyVariants("상표")).toEqual([]);
    expect(scoreKeyVariants("1234")).toEqual([]);
    expect(scoreKey("10-2021-0162560")).toBe("1020210162560");
  });

  it("13자리 등록번호(…0000)는 10-NNNNNNN 형태로도 찾는다", () => {
    expect(registrationShortForm("10-2602-7940000")).toBe("102602794");
    expect(registrationShortForm("1026027940000")).toBe("102602794");
    expect(registrationShortForm("10-2456789")).toBeNull();
    expect(registrationShortForm("")).toBeNull();
    expect(scoreKeyVariants(registrationShortForm("1026027940000")!)).toEqual(["102602794", "10-2602794"]);
  });

  it("chunk는 정해진 크기로 나눈다", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 200)).toEqual([]);
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("캐시된 사업화점수·TRL 조회", () => {
  it("한 번에 최대 200개 키씩 나눠 조회하고 중복 키는 한 번만 보낸다", async () => {
    const numbers = Array.from({ length: 250 }, (_, i) => `10-2021-${String(i).padStart(7, "0")}`);
    const fetcher = vi.fn(async (keys: string[]): Promise<ScoreCacheRow[]> => (keys.includes("1020210000007") ? [{ patent_number: "1020210000007", total_score: 72, trl: 5 }] : []));
    const map = await lookupCachedScores([...numbers, numbers[0]], fetcher);
    const sent = fetcher.mock.calls.map(([keys]) => keys);
    expect(sent.every((k) => k.length <= 200)).toBe(true);
    expect(sent.flat()).toHaveLength(500); // 250건 × (숫자형 + 하이픈형)
    expect(new Set(sent.flat()).size).toBe(500);
    expect(map.get("1020210000007")).toEqual({ totalScore: 72, trl: 5 });
  });

  it("하이픈 형식의 옛 행도 찾되 숫자형 행이 있으면 그것을 쓴다", async () => {
    const rows: ScoreCacheRow[] = [
      { patent_number: "1020210162560", total_score: 80, trl: 6 },
      { patent_number: "10-2021-0162560", total_score: 50, trl: 3 },
      { patent_number: "10-2456789", total_score: 64, trl: 4 },
    ];
    const map = await lookupCachedScores(["10-2021-0162560", "10-2456789"], async () => rows);
    expect(map.get("1020210162560")).toEqual({ totalScore: 80, trl: 6 });
    expect(scoreFor(map, ["", "10-2456789"])).toEqual({ totalScore: 64, trl: 4 });
    expect(scoreFor(map, ["10-2099-0000001"])).toBeNull();
  });

  it("조회할 번호가 없으면 요청하지 않는다", async () => {
    const fetcher = vi.fn(async () => []);
    expect((await lookupCachedScores(["", "상표"], fetcher)).size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
