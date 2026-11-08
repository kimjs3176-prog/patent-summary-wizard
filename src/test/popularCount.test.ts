import { describe, expect, it } from "vitest";
import { shouldCountPopular } from "@/lib/popularCount";

describe("인기 검색 집계", () => {
  it("방문 기록 한 칸마다 한 번만 센다 ('뒤로·앞으로'로 돌아온 요약서는 다시 세지 않는다)", () => {
    expect(shouldCountPopular("entry-a")).toBe(true);
    expect(shouldCountPopular("entry-b")).toBe(true);
    expect(shouldCountPopular("entry-a")).toBe(false);
    expect(shouldCountPopular("entry-b")).toBe(false);
  });
});
