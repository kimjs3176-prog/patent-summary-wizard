import { describe, expect, it } from "vitest";
import { getPatentVideoUrls } from "@/lib/patentVideo";

describe("getPatentVideoUrls", () => {
  it("특허번호의 숫자만으로 R2 경로를 만든다", () => {
    expect(getPatentVideoUrls("10-2024-0012345", "https://media.x.kr/")?.video).toBe(
      "https://media.x.kr/patents/1020240012345.mp4",
    );
  });
  it("주소가 설정되지 않으면 영상을 표시하지 않는다", () => {
    expect(getPatentVideoUrls("1020240012345", "")).toBeNull();
  });
});
