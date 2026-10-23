import { describe, it, expect } from "vitest";
import { buildResults, mergeCandidates, readinessMatch, sanitizeTerms, MAX_RESULTS } from "../../supabase/functions/find-my-patents/finderPolicy";

const p = (patentId: string, applicant: string, title = "딸기 저장 방법") => ({ patentId, title, applicant });

describe("나만의 특허찾기 규칙", () => {
  it("6개 기관 밖 출원인의 특허는 후보에서 제외", () => {
    const merged = mergeCandidates([{ term: "딸기", patents: [p("10-1", "대한민국(농촌진흥청장)"), p("10-2", "주식회사 에이")] }]);
    expect(merged.map((c) => c.patentId)).toEqual(["10-1"]);
  });

  it("여러 검색어에 걸린 특허가 먼저 오고 중복은 하나로 합침", () => {
    const merged = mergeCandidates([
      { term: "딸기", patents: [p("10-1", "농촌진흥청"), p("10-2", "국립종자원")] },
      { term: "저장", patents: [p("10-2", "국립종자원")] },
    ]);
    expect(merged[0].patentId).toBe("10-2");
    expect(merged[0].hits).toBe(2);
    expect(merged).toHaveLength(2);
  });

  it("AI가 후보에 없는 특허를 내면 버림", () => {
    const cands = mergeCandidates([{ term: "딸기", patents: [p("10-1", "농촌진흥청")] }]);
    const out = buildResults([{ patentId: "10-999", fit: 90, reason: "이유" }, { patentId: "10-1", fit: 80, reason: "이유" }], cands, "any");
    expect(out.map((r) => r.patentId)).toEqual(["10-1"]);
  });

  it("적합도 50 미만은 제외하고 100 초과는 100으로", () => {
    const cands = mergeCandidates([{ term: "딸기", patents: [p("10-1", "농촌진흥청"), p("10-2", "농촌진흥청")] }]);
    const out = buildResults([{ patentId: "10-1", fit: 140, reason: "이유" }, { patentId: "10-2", fit: 49, reason: "이유" }], cands, "any");
    expect(out).toHaveLength(1);
    expect(out[0].fit).toBe(100);
  });

  it("추천은 최대 12건", () => {
    const patents = Array.from({ length: 20 }, (_, i) => p(`10-${i}`, "농촌진흥청"));
    const cands = mergeCandidates([{ term: "딸기", patents }]);
    const out = buildResults(patents.map((x) => ({ patentId: x.patentId, fit: 80, reason: "이유" })), cands, "any");
    expect(out).toHaveLength(MAX_RESULTS);
    expect(MAX_RESULTS).toBe(12);
  });

  it("원하는 완성도: 바로 적용=TRL 7~9, 일부 보완=4~6, 공동개발=1~3, TRL 모르면 판단 안 함", () => {
    expect(readinessMatch("ready", 7)).toBe(true);
    expect(readinessMatch("ready", 6)).toBe(false);
    expect(readinessMatch("improve", 4)).toBe(true);
    expect(readinessMatch("codevelop", 4)).toBe(false);
    expect(readinessMatch("ready", null)).toBeNull();
  });

  it("검색어는 최대 5개, 허용 문자만", () => {
    const terms = sanitizeTerms(["딸기잼", "저당<script>", "펙틴", "당 대체", "잼 제조", "과채 가공", "농축"], []);
    expect(terms).toEqual(["딸기잼", "펙틴", "당 대체", "잼 제조", "과채 가공"]);
  });
});
