import { describe, it, expect } from "vitest";
import {
  buildCards, fallbackRoute, normalizeRoute, pickTrendField, sanitizeQuery, MAX_PATENT_CARDS,
} from "../../supabase/functions/patent-chat/chatPolicy";
import { applyEvent, toRequestMessages, visibleCards, type ChatMessage } from "@/lib/patentChat";

const RDA = "대한민국(농촌진흥청장)";

describe("물어보기 질문 분류", () => {
  it("주제 없이 요즘 좋은 기술을 물으면 동향 기반 추천", () => {
    const r = normalizeRoute({ tools: [], recommendFromTrend: true }, "요새 활용하면 좋은 기술 있을까?");
    expect(r.tools).toEqual(["trends"]);
    expect(r.recommendFromTrend).toBe(true);
    expect(r.query).toBe("");
  });

  it("검색어가 일반어뿐이면 특허 검색을 하지 않음", () => {
    expect(sanitizeQuery("좋은 기술 추천")).toBe("");
    const r = normalizeRoute({ tools: ["search"], query: "기술 추천" }, "기술 추천해줘");
    expect(r.tools).not.toContain("search");
  });

  it("허용되지 않는 문자를 지운 검색어만 사용", () => {
    expect(sanitizeQuery("딸기<script> 저장!")).toBe("딸기 script 저장");
  });

  it("AI 분류가 실패하면 기술이전 질문은 절차 안내로", () => {
    expect(fallbackRoute("기술이전은 어떻게 받나요?").tools).toEqual(["transfer"]);
  });

  it("후속 질문은 새 조회 없이 이전 대화로 답함", () => {
    const r = normalizeRoute({ tools: [], fromHistory: true }, "첫 번째 특허 TRL은?");
    expect(r.tools).toEqual([]);
  });
});

describe("동향 기반 추천 분야", () => {
  it("출원 10건 이상 분야 중 증가율이 가장 높은 분야", () => {
    const f = pickTrendField([
      { id: "food", latest: 80, previous: 70, growth: 14, share: 30 },
      { id: "computing", latest: 30, previous: 16, growth: 88, share: 10 },
      { id: "bio", latest: 4, previous: 1, growth: 300, share: 2 },
    ]);
    expect(f?.id).toBe("computing");
  });
});

describe("특허 카드", () => {
  const hits = [
    { patentId: "10-2762769", title: "딸기 완충포장", applicant: RDA, applicationDate: "2022.10.06" },
    { patentId: "10-1111111", title: "기업 특허", applicant: "주식회사 에이" },
    { patentId: "10-2023-0186270", title: "딸기 냉난방", organizationName: "농촌진흥청" },
  ];

  it("6개 기관 밖 특허는 카드로 보여주지 않음", () => {
    expect(buildCards(hits, []).map((c) => c.patentId)).toEqual(["10-2762769", "10-2023-0186270"]);
  });

  it("저장된 점수만 붙이고, 없으면 미분석(null)으로 둠", () => {
    const cards = buildCards(hits, [{ patent_number: "102762769", total_score: 84, technology_score: 85, market_score: 80, business_score: 82, trl: 6 }]);
    expect(cards[0]).toMatchObject({ trl: 6, totalScore: 84 });
    expect(cards[1]).toMatchObject({ trl: null, totalScore: null });
  });

  it("카드는 최대 5건", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ patentId: `10-200000${i}`, title: `특허 ${i}`, applicant: RDA }));
    expect(buildCards(many, [])).toHaveLength(MAX_PATENT_CARDS);
  });
});

describe("대화 기록", () => {
  it("이전 답변의 특허 목록을 다음 질문에 함께 보냄", () => {
    let a: ChatMessage = { id: "a", role: "assistant", parts: [] };
    a = applyEvent(a, { type: "tool-start", id: "t1", toolName: "search", title: "특허 검색", input: {} });
    a = applyEvent(a, { type: "tool-result", id: "t1", output: { cards: [{ patentId: "10-1", title: "딸기 포장", trl: 6, totalScore: 90 }] } });
    a = applyEvent(a, { type: "text-delta", delta: "추천합니다" });
    const msgs = toRequestMessages([{ id: "u", role: "user", parts: [{ type: "text", text: "딸기" }] }, a]);
    expect(msgs[1].content).toContain("1) 딸기 포장 (TRL 6, 사업화 종합 90)");
  });
});

describe("답변 아래 카드", () => {
  const withCards = (text: string): ChatMessage => {
    let a: ChatMessage = { id: "a", role: "assistant", parts: [] };
    a = applyEvent(a, { type: "tool-start", id: "t", toolName: "search", title: "특허 검색", input: {} });
    a = applyEvent(a, { type: "tool-result", id: "t", output: { cards: [
      { patentId: "1", title: "딸기 재배용 냉난방 시스템" },
      { patentId: "2", title: "선도 유지를 위한 딸기 포장 용기" },
      { patentId: "3", title: "딸기 전용 포장용기" },
    ] } });
    return applyEvent(a, { type: "text-delta", delta: text });
  };

  it("답변이 언급한 특허만, 언급한 순서대로 보여줌", () => {
    const cards = visibleCards(withCards("**딸기 전용 포장용기**와 **선도 유지를 위한 딸기 포장 용기**를 추천합니다."));
    expect(cards.map((c) => c.patentId)).toEqual(["3", "2"]);
  });

  it("어느 특허도 언급하지 않으면 찾은 카드를 모두 보여줌", () => {
    expect(visibleCards(withCards("관련 특허를 찾았습니다."))).toHaveLength(3);
  });
});
