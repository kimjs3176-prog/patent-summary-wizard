import { describe, expect, it } from "vitest";
import { datasheetSlots } from "@/lib/datasheet";

describe("datasheetSlots", () => {
  it("places the five known sections and sends the rest to extra", () => {
    const slots = datasheetSlots(["기술 분야", "발명 요약", "농산업 활용", "시장 동향", "상용화 전망", "기타"]);
    expect(slots).toEqual({ tech: [0], invention: [1], use: [2], market: [3], biz: [4], extra: [5] });
  });

  it("keeps only the first section per slot", () => {
    const slots = datasheetSlots(["발명 요약", "발명 요약"]);
    expect(slots.invention).toEqual([0]);
    expect(slots.extra).toEqual([1]);
  });
});
