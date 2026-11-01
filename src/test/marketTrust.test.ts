import { describe, it, expect } from "vitest";
import {
  AI_ESTIMATE_NOTE,
  applyGlobalRef,
  applyMarketRef,
  claimToRef,
  currentSeoulYear,
  extractGlobalClaims,
  extractMarketClaims,
  formatKrwEok,
  hasRequiredMarketFigures,
  parseKrwEok,
  parseKrwRange,
  reconcileMarketSection,
  type MarketRef,
} from "../../supabase/functions/summarize-patent/marketConsistency";

const Y = 2026;

describe("금액 표기 변형 (범위·만원·백만원)", () => {
  it("범위는 하한, 만/백만/천만 단위는 억 원으로 환산", () => {
    expect(parseKrwRange("1,000~1,200억")).toEqual({ lo: 1000, hi: 1200 });
    expect(parseKrwRange("1,000억 원~1,200억")).toEqual({ lo: 1000, hi: 1200 });
    expect(parseKrwEok("1조~1조 2,000억")).toBe(10000);
    expect(parseKrwEok("950만")).toBe(0.095);
    expect(parseKrwEok("1,200백만")).toBe(12);
    expect(parseKrwEok("3천만")).toBe(0.3);
    expect(formatKrwEok(0.095)).toBe("950만");
    expect(formatKrwEok(12)).toBe("12억");
  });

  it("범위·만원·백만원 표기에서도 시장 주장을 추출한다", () => {
    const range = extractMarketClaims("국내 스마트팜 시장은 2023년 약 1,000~1,200억 원 규모이며 연평균 8.5% 성장할 전망이다.", Y);
    expect(range).toEqual([{ label: "국내 스마트팜 시장", key: "국내스마트팜시장", baseYear: 2023, baseEok: 1000, cagr: 8.5 }]);
    const man = extractMarketClaims("국내 식용곤충 체험 시장은 2024년 약 950만 원 수준으로 연평균 5% 성장한다.", Y);
    expect(man[0]).toMatchObject({ key: "국내식용곤충체험시장", baseEok: 0.095, cagr: 5 });
    const baekman = extractMarketClaims("국내 사료첨가제 시장은 2023년 1,200백만 원 규모로 연평균 4.1% 성장한다.", Y);
    expect(baekman[0]).toMatchObject({ baseEok: 12, cagr: 4.1 });
  });

  it("표준값을 적용하면 범위 전체를 한 값으로 바꾼다", () => {
    const ref: MarketRef = { market_key: "국내스마트팜시장", label: "국내 스마트팜 시장", base_year: 2023, base_value_eok: 1100, cagr: 8 };
    const out = applyMarketRef("국내 스마트팜 시장은 2023년 약 1,000~1,200억 원 규모이며 연평균 8.5% 성장해 2026년 약 1,400억 원에 이를 전망이다.", ref, Y);
    expect(out).toBe("국내 스마트팜 시장은 2023년 약 1,100억 원 규모이며 연평균 8% 성장해 2026년 약 1,386억 원에 이를 전망이다.");
  });

  it("필수 수치 검사도 같은 표기 규칙을 따른다", () => {
    expect(hasRequiredMarketFigures("## 관련시장 동향\n국내 사료첨가제 시장은 2023년 1,200백만 원 규모로 연평균 4.1% 성장한다.")).toBe(true);
    expect(hasRequiredMarketFigures("## 관련시장 동향\n국내 X 시장은 2023년 약 1,000~1,200억 원이며 CAGR 5%다.")).toBe(true);
    expect(hasRequiredMarketFigures("## 관련시장 동향\n시장 규모가 커지고 있다.")).toBe(false);
  });
});

describe("시장 범위 단위 일괄 보정 (기준값·CAGR·전망값)", () => {
  it("다음 문장의 전망값과 CAGR까지 함께 다시 쓴다", () => {
    const text = "국내 버섯 시장은 2023년 약 900억 원 규모로 추정된다. 이 시장은 연평균 6.5% 성장해 2026년 약 1,092억 원에 이를 전망이다.";
    const ref: MarketRef = { market_key: "국내버섯시장", label: "국내 버섯 시장", base_year: 2023, base_value_eok: 1500, cagr: 6.5 };
    const out = applyMarketRef(text, ref, Y);
    expect(out).toContain("2023년 약 1,500억 원");
    expect(out).toContain("2026년 약 1,812억 원");
    expect(out).not.toContain("1,092억");
  });

  it("기준연도가 바뀌면 전망값도 표준 기준연도로 다시 계산한다", () => {
    const text = "국내 건강기능식품 시장은 2022년 약 6조 원이다. 연평균 성장률 7%를 적용하면 2026년 약 7조 8,000억 원으로 확대된다.";
    const ref: MarketRef = { market_key: "국내건강기능식품시장", label: "국내 건강기능식품 시장", base_year: 2024, base_value_eok: 40131, cagr: 6.3, source: "KOSIS", status: "official" };
    const out = applyMarketRef(text, ref, Y);
    expect(out).toContain("2024년 약 4조 131억 원");
    expect(out).toContain("연평균 성장률 6.3%");
    expect(out).toContain("2026년 약 4조 5,347억 원");
  });

  it("'까지' 형태의 미래 전망값도 범위에 포함된다", () => {
    const text = "국내 종자 시장은 2022년 약 8,000억 원이며 2030년까지 연평균 7.2% 성장해 약 2조 원에 이를 전망이다.";
    const ref: MarketRef = { market_key: "국내종자시장", label: "국내 종자 시장", base_year: 2022, base_value_eok: 8000, cagr: 7.2 };
    expect(applyMarketRef(text, ref, Y)).toContain("약 1조 3,952억 원");
  });

  it("세부 시장 문장('이 중 …')의 수치는 상위 시장 표준값으로 덮지 않는다", () => {
    const text = "국내 사료 시장은 2023년 약 10조 원 규모로 연평균 4% 성장한다. 이 중 미생물 첨가제는 2023년 약 1,250억 원 규모다.";
    const ref: MarketRef = { market_key: "국내사료시장", label: "국내 사료 시장", base_year: 2023, base_value_eok: 102000, cagr: 4.2 };
    const out = applyMarketRef(text, ref, Y);
    expect(out).toContain("10조 2,000억 원");
    expect(out).toContain("1,250억 원");
  });
});

describe("국내·글로벌 CAGR 교차 귀속 방지", () => {
  it("한 문장에 두 시장이 있으면 각자의 CAGR만 인정하고 섞지 않는다", () => {
    const t = "국내 사료 시장은 2023년 약 10조 원이고 글로벌 사료 시장은 2023년 USD 4,000억 규모로 연평균 4.5% 성장한다.";
    expect(extractMarketClaims(t, Y)[0]).toMatchObject({ key: "국내사료시장", cagr: null });
    expect(extractGlobalClaims(t, Y)[0]).toMatchObject({ key: "글로벌사료시장", baseEok: 4000, cagr: 4.5 });
    const out = applyMarketRef(t, { market_key: "국내사료시장", label: "국내 사료 시장", base_year: 2023, base_value_eok: 102000, cagr: 3.1 }, Y);
    expect(out).toContain("연평균 4.5%");
    expect(out).toContain("USD 4,000억");
    expect(out).not.toContain("3.1%");
  });

  it("'각각' 처럼 귀속이 모호한 CAGR은 어느 시장에도 저장하지 않는다", () => {
    const t = "국내 농업용 드론 시장은 2023년 약 1,500억 원, 글로벌 농업용 드론 시장은 2024년 약 USD 54억 규모이며 연평균 각각 12.0%, 28.6% 성장할 전망이다.";
    expect(extractMarketClaims(t, Y)[0]?.cagr).toBeNull();
    expect(extractGlobalClaims(t, Y)[0]?.cagr).toBeNull();
    const out = applyGlobalRef(t, { market_key: "글로벌농업용드론시장", label: "글로벌 농업용 드론 시장", base_year: 2024, base_value_eok: 60, cagr: 25 }, Y);
    expect(out).toContain("USD 60억");
    expect(out).toContain("12.0%, 28.6%");
    expect(out).toContain("1,500억 원");
  });

  it("글로벌 표준값은 국내 문장의 CAGR을 바꾸지 않는다", () => {
    const t = "글로벌 스마트팜 시장은 2024년 약 USD 180억 규모다. 국내 스마트팜 시장은 2023년 약 6,000억 원으로 연평균 10.5% 성장한다.";
    const out = applyGlobalRef(t, { market_key: "글로벌스마트팜시장", label: "글로벌 스마트팜 시장", base_year: 2024, base_value_eok: 200, cagr: 13.4 }, Y);
    expect(out).toContain("USD 200억");
    expect(out).toContain("10.5%");
    expect(out).not.toContain("13.4%");
  });
});

describe("표준값 신뢰 수준과 출처 표기", () => {
  it("새 AI 주장은 출처 없는 ai_pending으로만 저장하고, CAGR 30% 초과는 저장하지 않는다", () => {
    const base = { label: "국내 버섯 시장", key: "국내버섯시장", baseYear: 2023, baseEok: 900 };
    expect(claimToRef({ ...base, cagr: 6.5 })).toMatchObject({ status: "ai_pending", source: null, cagr: 6.5 });
    expect(claimToRef({ ...base, cagr: 30 })).not.toBeNull();
    expect(claimToRef({ ...base, cagr: 31 })).toBeNull();
    expect(claimToRef({ ...base, cagr: 0 })).toBeNull();
    expect(claimToRef({ ...base, cagr: null })).toBeNull();
  });

  it("검증 전 표준값으로 맞춘 수치는 기관명 대신 (AI 추정치)를 단다", () => {
    const section = "국내 버섯 시장은 2023년 약 900억 원 규모다(한국농촌경제연구원, 2023). 이 시장은 연평균 6.5% 성장해 2026년 약 1,092억 원에 이를 전망이다(KREI 「농업전망」, 2024). 정부는 스마트농업 확산을 추진하고 있다(농림축산식품부, 2024).";
    const pending: MarketRef = { market_key: "국내버섯시장", label: "국내 버섯 시장", base_year: 2023, base_value_eok: 1500, cagr: 6.5, source: null, status: "ai_pending" };
    const out = reconcileMarketSection(section, [pending], { targetYear: Y });
    expect(out).toContain(`2023년 약 1,500억 원 규모다${AI_ESTIMATE_NOTE}.`);
    expect(out).toContain(`2026년 약 1,812억 원에 이를 전망이다${AI_ESTIMATE_NOTE}.`);
    expect(out).not.toContain("한국농촌경제연구원");
    expect(out).not.toContain("KREI");
    // 수치가 없는 정책 문장의 출처는 그대로 둔다
    expect(out).toContain("(농림축산식품부, 2024)");
    // 반복 적용해도 같은 결과 (캐시 재보정)
    expect(reconcileMarketSection(out, [pending], { targetYear: Y })).toBe(out);
  });

  it("공식 통계 표준값은 그 출처를 달고, 다른 시장의 AI 수치는 (AI 추정치)로 남긴다", () => {
    const section = "국내 건강기능식품 시장은 2023년 약 6조 2,022억 원이다(한국건강기능식품협회, 2023). 글로벌 건강기능식품 시장은 2024년 약 USD 1,800억 규모로 연평균 8.6% 성장한다(Grand View Research, 2024).";
    const official: MarketRef = { market_key: "국내건강기능식품시장", label: "국내 건강기능식품 시장", base_year: 2024, base_value_eok: 40131, cagr: 6.3, source: "KOSIS 국가통계포털", status: "official" };
    const out = reconcileMarketSection(section, [official], { targetYear: Y });
    expect(out).toContain("2024년 약 4조 131억 원이다(출처: KOSIS 국가통계포털, 2024년 기준).");
    expect(out).not.toContain("한국건강기능식품협회");
    expect(out).toContain(`8.6% 성장한다${AI_ESTIMATE_NOTE}.`);
    expect(out).not.toContain("Grand View Research");
    expect(reconcileMarketSection(out, [official], { targetYear: Y })).toBe(out);
  });

  it("관리자 승인값이라도 출처가 없으면 출처를 지어내지 않는다", () => {
    const approvedNoSource: MarketRef = { market_key: "국내버섯시장", label: "국내 버섯 시장", base_year: 2023, base_value_eok: 1500, cagr: 6.5, source: "", status: "approved" };
    const out = reconcileMarketSection("국내 버섯 시장은 2023년 약 900억 원 규모다.", [approvedNoSource], { targetYear: Y });
    expect(out).toBe(`국내 버섯 시장은 2023년 약 1,500억 원 규모다${AI_ESTIMATE_NOTE}.`);
  });

  it("CAGR이 상한을 넘는 예전 검증 전 표준값은 다시 적용하지 않는다", () => {
    const legacy: MarketRef = { market_key: "국내버섯시장", label: "국내 버섯 시장", base_year: 2023, base_value_eok: 1500, cagr: 55, status: "ai_pending" };
    const out = reconcileMarketSection("국내 버섯 시장은 2023년 약 900억 원 규모로 연평균 6.5% 성장한다.", [legacy], { targetYear: Y });
    expect(out).toContain("900억 원");
    expect(out).not.toContain("55%");
  });

  it("운영자 고정 문단(대체 문단)의 출처는 바꾸지 않는다", () => {
    const fallback = "국내 드론 산업은 2022년 약 8,406억 원 규모다(국토교통부, 2023).";
    expect(reconcileMarketSection(fallback, [], { targetYear: Y, exempt: [fallback] })).toBe(fallback);
  });
});

describe("기준연도는 올해(한국 시간)에서 정한다", () => {
  it("한국 시간 기준 연도를 쓴다", () => {
    expect(currentSeoulYear(new Date("2026-12-31T15:30:00Z"))).toBe(2027);
    expect(currentSeoulYear(new Date("2026-12-31T14:30:00Z"))).toBe(2026);
  });
  it("올해 이후 연도는 기준연도로 쓰지 않는다", () => {
    const t = "국내 스마트팜 시장은 2026년 약 1조 원으로 추정되며 2025년 약 9,000억 원에서 연평균 11% 성장했다.";
    expect(extractMarketClaims(t, 2026)[0]).toMatchObject({ baseYear: 2025, baseEok: 9000 });
    expect(extractMarketClaims(t, 2027)[0]).toMatchObject({ baseYear: 2026, baseEok: 10000 });
  });
  it("전망연도 값은 본문에 적힌 연도로 계산해 올해가 바뀌어도 같다", () => {
    const ref: MarketRef = { market_key: "국내종자시장", label: "국내 종자 시장", base_year: 2022, base_value_eok: 8000, cagr: 7.2 };
    const t = "국내 종자 시장은 2022년 약 8,000억 원이며 연평균 7.2% 성장해 2026년 약 1조 471억 원이다.";
    expect(applyMarketRef(t, ref, 2026)).toContain("1조 565억");
    expect(applyMarketRef(t, ref, 2028)).toContain("1조 565억");
  });
});
