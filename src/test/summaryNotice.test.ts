import { describe, expect, it } from "vitest";
import { DEFAULT_SUMMARY_DISCLAIMER, formatReportDate, sheetFooterNote, summaryDisclaimerText } from "@/lib/summaryNotice";

describe("요약서 참고자료 안내", () => {
  it("관리자가 저장한 문구를 쓰고, 비어 있으면 기본 문구", () => {
    expect(summaryDisclaimerText("※ 운영자 문구입니다.")).toBe("※ 운영자 문구입니다.");
    expect(summaryDisclaimerText("")).toBe(DEFAULT_SUMMARY_DISCLAIMER);
    expect(summaryDisclaimerText(undefined)).toBe(DEFAULT_SUMMARY_DISCLAIMER);
  });

  it("실제 입력(공개 초록·청구항)과 다른 '특허명세서를 바탕으로'는 고쳐 보여 준다", () => {
    // 운영 DB 에 저장된 문구 그대로
    expect(summaryDisclaimerText("※ 본 분석은 특허명세서를 바탕으로 AI가 분석한 내용이며, 실제 연구 및 개발 단계와는 상이할 수 있음"))
      .toBe("※ 본 분석은 공개된 초록·청구항을 바탕으로 AI가 분석한 내용이며, 실제 연구 및 개발 단계와는 상이할 수 있음");
    expect(DEFAULT_SUMMARY_DISCLAIMER).toContain("초록·청구항을 바탕으로");
    expect(DEFAULT_SUMMARY_DISCLAIMER).not.toContain("명세서");
  });

  it("2쪽 바닥글: 참고자료임과 한국 날짜 기준 생성일 (한 줄)", () => {
    expect(formatReportDate("2026-11-03T06:29:35.187+00:00")).toBe("2026.11.03");
    // UTC 11월 2일 오후 4시 = 한국 11월 3일 새벽
    expect(formatReportDate("2026-11-02T16:00:00Z")).toBe("2026.11.03");
    expect(formatReportDate("not a date")).toBe("");
    expect(sheetFooterNote("2026-11-03T06:29:35.187+00:00")).toBe("AI 분석 참고자료 · 생성 2026.11.03");
    expect(sheetFooterNote(null)).toBe("AI 분석 참고자료");
  });
});
