import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { splitBold, splitItalic } from "@/lib/summaryMarkup";
import { parseSections } from "@/components/PatentSummary/toss/helpers";
import { AiSummarySections } from "@/components/PatentSummary/toss/AiSummarySections";
import { renderBold } from "@/components/PatentSummary/toss/RenderBold";

// 실측 요약서(v19) 발췌: 프롬프트가 요구하는 "볼드 안 학명 이탤릭" 표기.
const STRAIN = "## 기술분야\n\n본 발명은 안전성과 다기능성을 확보한 **신규한 *Leuconostoc mesenteroides* K2-4 균주** 및 이를 활용한 발효 조성물에 관한 기술이다.\n";
const RICE = "## 발명요약 및 특징\n\n본 발명은 저항성 유전자인 **`*qBK1*` 유전자를 보유한 최초의 자포니카형 벼 식물체 '밀양299호'**를 확립하였다.\n";

describe("볼드 안 학명 이탤릭", () => {
  it("볼드 범위가 이탤릭을 포함해도 하나의 볼드로 나눈다", () => {
    expect(splitBold("안전한 **신규한 *Leuconostoc mesenteroides* K2-4 균주** 및 조성물")).toEqual([
      { text: "안전한 " },
      { text: "신규한 *Leuconostoc mesenteroides* K2-4 균주", bold: true },
      { text: " 및 조성물" },
    ]);
    expect(splitItalic("신규한 *Leuconostoc mesenteroides* K2-4 균주")).toEqual([
      { text: "신규한 " },
      { text: "Leuconostoc mesenteroides", italic: true },
      { text: " K2-4 균주" },
    ]);
  });

  it("기존 표기(볼드·이탤릭 단독, 닫히지 않은 마커)는 그대로 처리한다", () => {
    expect(splitBold("**국내 시장** 그리고 *Oryza sativa* 그리고 **수율**")).toEqual([
      { text: "국내 시장", bold: true },
      { text: " 그리고 *Oryza sativa* 그리고 " },
      { text: "수율", bold: true },
    ]);
    expect(splitBold("닫히지 않은 **볼드")).toEqual([{ text: "닫히지 않은 **볼드" }]);
  });

  it("요약서 화면에 '**' 기호가 남지 않는다", () => {
    const sections = [...parseSections(STRAIN), ...parseSections(RICE)];
    const { container } = render(<AiSummarySections isStreaming={false} sections={sections} annotate={(t) => t} />);
    expect(container.textContent).not.toContain("*");
    const strong = [...container.querySelectorAll("strong")].map((s) => s.textContent);
    expect(strong).toEqual([
      "신규한 Leuconostoc mesenteroides K2-4 균주",
      "qBK1 유전자를 보유한 최초의 자포니카형 벼 식물체 '밀양299호'",
    ]);
    expect([...container.querySelectorAll("strong em")].map((e) => e.textContent)).toEqual(["Leuconostoc mesenteroides", "qBK1"]);
  });

  it("점수 근거 등 renderBold 경로도 같은 규칙을 따른다", () => {
    const { container } = render(<p>{renderBold("**신규한 *Bacillus subtilis* 균주**의 활성")}</p>);
    expect(container.textContent).toBe("신규한 Bacillus subtilis 균주의 활성");
    expect(container.querySelector("strong em")?.textContent).toBe("Bacillus subtilis");
  });
});
