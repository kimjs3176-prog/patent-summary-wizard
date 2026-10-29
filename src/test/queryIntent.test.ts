import { describe, expect, it } from "vitest";
import { classifyQuery } from "@/lib/queryIntent";

describe("classifyQuery — one search box for every input style", () => {
  it("keeps 1–2 word searches as broad keyword searches", () => {
    expect(classifyQuery("발효")).toBe("keyword");
    expect(classifyQuery("김치 유산균")).toBe("keyword");
    expect(classifyQuery("스마트팜")).toBe("keyword");
  });

  it("sends described needs to the strict sentence search", () => {
    expect(classifyQuery("음식 기름 제거")).toBe("sentence");
    expect(classifyQuery("딸기 저장기간을 늘리고 싶어요")).toBe("sentence");
    expect(classifyQuery("돼지 질병 진단 방법")).toBe("sentence");
  });

  it("sends questions and requests to the conversational assistant", () => {
    expect(classifyQuery("요새 활용하면 좋은 기술 있을까?")).toBe("question");
    expect(classifyQuery("요새 활용하면 좋은 기술 있을까")).toBe("question");
    expect(classifyQuery("최근 출원이 늘어난 분야는 어디야?")).toBe("question");
    expect(classifyQuery("딸기 저장기간을 늘리는 기술 추천해줘")).toBe("question");
    expect(classifyQuery("기술이전은 어떻게 받나요")).toBe("question");
    expect(classifyQuery("첫 번째 특허 TRL은 몇이야")).toBe("question");
  });

  it("opens patent numbers directly", () => {
    expect(classifyQuery("10-2020-0012345")).toBe("number");
    expect(classifyQuery("10-2020-0012345, 10-2021-0054321")).toBe("batch");
  });

  it("ignores empty input", () => {
    expect(classifyQuery("   ")).toBe("empty");
  });
});
