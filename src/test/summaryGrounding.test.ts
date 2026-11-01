import { describe, it, expect } from "vitest";
import { sourceFigures, stripUnsupportedEffectFigures } from "../../supabase/functions/summarize-patent/summaryGrounding";

// 실제 요약서(v19) 출력에서 가져온 문장 발췌(특허번호·출원인은 지움).
const microbeSource = {
  title: "인삼 병원균에 대하여 항균활성을 갖는 균주 및 이의 용도",
  abstract: "본 발명은 인삼에 점무늬병 또는 탄저병을 일으키는 병원균에 대한 항균활성이 뛰어나다.",
  claims: ["1. 인삼 병원균에 대하여 항균활성을 갖는 균주(수탁번호 KACC 92365P)로서 ...", "4. 상기 균주는 서열번호 1의 염기서열을 포함하는 것인, 균주."],
};

const summaryOf = (section: string, body: string) =>
  `## 기술분야\n기술분야 본문이다.\n\n## ${section}\n${body}\n\n## 관련시장 동향\n국내 생물농약 시장은 2023년 6,200억 원에서 연평균 6.8% 성장한다(AI 추정치).\n`;

describe("원문에 없는 효과 수치 제거", () => {
  it("원문에 없는 % 효과를 빼고 같은 문장을 정성 표현으로 남긴다", () => {
    const input = summaryOf(
      "농산업활용 가능성",
      "또한 생육기 경엽 처리를 병행할 경우 곰팡이 감염원을 차단하여 **병원균 이병률 30% 이상 감소** 효과를 달성할 수 있다. 결과적으로 약제 낭비를 15% 이상 방지하고 방제 효율을 높인다.",
    );
    const out = stripUnsupportedEffectFigures(input, microbeSource);
    expect(out).toContain("**병원균 이병률 감소** 효과를 달성할 수 있다.");
    expect(out).toContain("약제 낭비를 방지하고 방제 효율을 높인다.");
    expect(out).not.toMatch(/30%|15%/);
  });

  it("'기존 대비 약 N% 이상'과 '정량적 개선 효과'도 함께 정리한다", () => {
    const input = summaryOf(
      "농산업활용 가능성",
      "이에 따라 노동력 투입 시간이 **기존 대비 약 70% 이상 절감**되며 용수 손실률 또한 20% 이상 감축되는 정량적 개선 효과가 기대된다.",
    );
    expect(stripUnsupportedEffectFigures(input, microbeSource)).toContain(
      "이에 따라 노동력 투입 시간이 **절감**되며 용수 손실률 또한 감축되는 개선 효과가 기대된다.",
    );
  });

  it("상한(미만·이하)과 신뢰도 하한은 '낮은 수준'·'높은'으로 바꾼다", () => {
    const input = summaryOf(
      "발명요약 및 특징",
      "작기당 **품종 혼입 손실률을 5% 미만**으로 억제할 수 있다. 육묘 실패율을 10% 이하로 억제한다. 유전적 순도를 99% 이상의 신뢰도로 판정한다.",
    );
    const out = stripUnsupportedEffectFigures(input, microbeSource);
    expect(out).toContain("**품종 혼입 손실률을 낮은 수준**으로 억제할 수 있다.");
    expect(out).toContain("육묘 실패율을 낮은 수준으로 억제한다.");
    expect(out).toContain("유전적 순도를 높은 신뢰도로 판정한다.");
  });

  it("서열번호·청구항 번호처럼 단위 없는 숫자는 근거로 보지 않는다", () => {
    // 원문에 '1', '4' 는 있지만 '%'와 함께 쓰인 적은 없다.
    expect(sourceFigures(microbeSource).percent.size).toBe(0);
    const input = summaryOf("상용화전망", "현장 적용 시 방제 비용을 4% 이상 절감할 수 있다.");
    expect(stripUnsupportedEffectFigures(input, microbeSource)).toContain("방제 비용을 절감할 수 있다.");
  });

  it("원문에 있는 수치(배합비·회복률 범위)는 그대로 둔다", () => {
    const src = {
      claims: [
        "6. 상기 적팥앙금은 99%중의 팥과 1%중의 설탕으로 구성되고 ...",
        "7. 반복친과 우량계통 유전형의 회복률이 73 내지 100% 것인 방법.",
        "8. 기존 대비 2배 향상된 것인 조성물.",
      ],
    };
    const input = summaryOf(
      "발명요약 및 특징",
      "**팥 99%와 설탕 1% 조성의 적팥앙금**을 제조한다. 후대 개체 중 회복률 73~100% 향상 개체를 선발한다. 수율이 2배 향상된다.",
    );
    expect(stripUnsupportedEffectFigures(input, src)).toBe(input);
  });

  it("기술분야·관련시장 동향은 건드리지 않고, 원문이 없으면 판단하지 않는다", () => {
    const input = `## 기술분야\n방제 효율을 30% 향상하는 분야이다.\n\n## 관련시장 동향\n국내 X 시장은 2023년 1,000억 원에서 연평균 5% 증가한다(AI 추정치).\n\n## 농산업활용 가능성\n살포량을 20% 줄인다.\n`;
    const out = stripUnsupportedEffectFigures(input, microbeSource);
    expect(out).toContain("방제 효율을 30% 향상하는 분야이다.");
    expect(out).toContain("연평균 5% 증가한다");
    expect(out).toContain("살포량을 줄인다.");
    expect(stripUnsupportedEffectFigures(input, null)).toBe(input);
    expect(stripUnsupportedEffectFigures(input, { abstract: "" })).toBe(input);
  });
});
