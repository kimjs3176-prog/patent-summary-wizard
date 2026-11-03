import { describe, it, expect } from "vitest";
import { BOLD_RULES, MAX_BOLD_CHARS, countBoldBySection, tidyBold } from "../../supabase/functions/summarize-patent/boldPolicy";
import { splitBold } from "@/lib/summaryMarkup";

describe("요약서 중요 문구 볼드 규칙", () => {
  it("섹션마다 반드시 볼드할 대상과 개수·점검 단계를 모델에 준다", () => {
    for (const s of ["기술분야:", "발명요약 및 특징:", "관련시장 동향:", "농산업활용 가능성:", "상용화전망:"]) expect(BOLD_RULES).toContain(s);
    expect(BOLD_RULES).toContain("섹션마다 3~5곳");
    expect(BOLD_RULES).toContain("첫 문장(요지)");
    expect(BOLD_RULES).toContain("다 쓴 뒤 점검");
    // 볼드가 요지 문장에만 몰리지 않게: 본문 문단마다 최소 1곳
    expect(BOLD_RULES).toContain("본문 문단마다 최소 1곳");
  });

  it("관련시장 동향의 숫자 볼드는 풀고 시장명 볼드는 남긴다", () => {
    const md = "## 관련시장 동향\n\n**국내 친환경 농자재 시장** 규모는 2023년 **6,200억 원**이며 **연평균 6.8%** 성장한다.\n\n## 상용화전망\n\n**분말 제형 0.2~1.2 중량부 처리**가 핵심이다.";
    const out = tidyBold(md);
    expect(out).toContain("**국내 친환경 농자재 시장** 규모는 2023년 6,200억 원이며 연평균 6.8% 성장한다.");
    // 다른 섹션의 수치 볼드는 그대로
    expect(out).toContain("**분말 제형 0.2~1.2 중량부 처리**");
  });

  it("문장 통째 볼드와 짝 없는 별표를 정리한다", () => {
    const long = "가".repeat(MAX_BOLD_CHARS + 1);
    expect(tidyBold(`## 기술분야\n\n**${long}** 이다.`)).toBe(`## 기술분야\n\n${long} 이다.`);
    expect(tidyBold("## 기술분야\n\n**짝이 없는 볼드 이다.")).toBe("## 기술분야\n\n짝이 없는 볼드 이다.");
    // 학명 이탤릭이 든 볼드는 별표·백틱을 빼고 길이를 잰다
    const sci = "**`*Pichia anomala*` 및 `*Lactobacillus confusa*` 균주**";
    expect(tidyBold(`## 발명요약 및 특징\n\n${sci}로 발효한다.`)).toContain(sci);
    expect(splitBold(sci.replace(/`/g, ""))[0].bold).toBe(true);
  });

  it("섹션별 볼드 수를 센다", () => {
    expect(countBoldBySection("## 기술분야\n\n**가** 와 **나**.\n\n## 상용화전망\n\n없다.")).toEqual({ 기술분야: 2, 상용화전망: 0 });
  });
});
