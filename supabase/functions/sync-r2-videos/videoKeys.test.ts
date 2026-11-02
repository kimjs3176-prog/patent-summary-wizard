import { describe, expect, it } from "vitest";
import { keyFromUrl, publicUrl, titleFromKey } from "./videoKeys";

const BASE = "https://pub-x.r2.dev";

describe("titleFromKey", () => {
  it("drops numbering, dates, sizes and edit marks", () => {
    expect(titleFromKey("1편_육류숙성과 냉각해동_0911_2880 × 1152_편집.mp4").title).toBe("육류숙성과 냉각해동");
    expect(titleFromKey("4회차_3편_제주조릿대·선씀바귀 기능성 소재 (뇌건강·혈당)_1009_2880 x 1152.mp4").title)
      .toBe("제주조릿대·선씀바귀 기능성 소재 (뇌건강·혈당)");
    expect(titleFromKey("4. 기술소개영상_신규 보리 계통 '베타헬스'_vF.mp4").title).toBe("신규 보리 계통 '베타헬스'");
  });
  it("reads a leading [분류] as the category", () => {
    expect(titleFromKey("[식품·가공] 발효 감초.mp4")).toEqual({ title: "발효 감초", category: "식품·가공" });
  });
});

describe("keyFromUrl", () => {
  it("matches differently encoded URLs of the same file", () => {
    const key = "4회차 1편_감초 (피부)_1009.mp4";
    const manual = `${BASE}/${encodeURI(key)}`;
    expect(keyFromUrl(BASE, manual)).toBe(keyFromUrl(BASE, publicUrl(BASE, key)));
  });
  it("ignores other hosts", () => {
    expect(keyFromUrl(BASE, "https://youtu.be/abc")).toBeNull();
  });
});
