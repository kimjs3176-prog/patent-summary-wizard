import { describe, expect, it } from "vitest";
import { visitDateKey } from "@/lib/visitDate";

describe("방문 수 '오늘'", () => {
  it("서버가 세는 날짜(UTC)로 찾는다: 한국 시각 새벽에도 서버가 막 센 행을 찾는다", () => {
    // 2026-11-08 00:27 한국 시각 = 2026-11-07 15:27 UTC. 서버는 이 방문을 2026-11-07 행에 더한다.
    expect(visitDateKey(new Date("2026-11-08T00:27:00+09:00"))).toBe("2026-11-07");
    expect(visitDateKey(new Date("2026-11-08T10:00:00+09:00"))).toBe("2026-11-08");
  });
});
