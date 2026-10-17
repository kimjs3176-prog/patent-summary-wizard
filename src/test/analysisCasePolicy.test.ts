import { describe, expect, it } from "vitest";
import { buildEvidenceCase, CASE_POLICY_VERSION, INSTITUTE_NAMES, selectEvidenceCases, sourceSignature, validateAnalysisResult } from "../../supabase/functions/_shared/analysisCasePolicy";

const original = { title: "벼 유전자 분석", assignee: "대한민국(농촌진흥청장)", applicationNumber: "10-2022-0179091", classifications: ["C12N 15/82"], abstract: "벼의 유전자 발현을 조절하는 단백질 및 효소의 활성을 확인하는 방법으로 종자의 유전자 발현 조절 기능을 실험에서 확인하였다." };
describe("자동 검증 원문 사례", () => {
  it.each(INSTITUTE_NAMES)("서비스 대상 기관 %s의 원문만 허용", assignee => {
    expect(buildEvidenceCase("1020220179091", { ...original, assignee })?.field_id).toBe("bio");
  });
  it("대상 밖 출원인은 배제", () => expect(buildEvidenceCase("123", { ...original, assignee: "일반 기업" })).toBeNull());
  it("IPC 없는 데이터는 배제", () => expect(buildEvidenceCase("123", { ...original, classifications: [] })).toBeNull());
  it("변조된 원문은 서버 원문 서명과 다름", () => expect(sourceSignature({ ...original, abstract: "변조" })).not.toBe(sourceSignature(original)));
  it("원문 외 AI 주장이나 시장 수치 필드를 저장하지 않음", () => {
    const c = buildEvidenceCase("123", { ...original, analysis: "TRL 9 시장규모 100조" } as typeof original);
    expect(c?.evidence).toEqual([original.abstract]);
    expect(JSON.stringify(c)).not.toContain("100조");
  });
  it("같은 출원·등록 특허, 다른 분야, 오래된 정책 사례 제외", () => {
    const c = buildEvidenceCase("1020220179091", original);
    if (!c) throw new Error("fixture missing");
    const other = { ...c, patent_key: "102023001", identity_keys: ["102023001"] };
    expect(selectEvidenceCases(c, [c, { ...other, field_id: "food" }, { ...other, policy_version: "old" }, other])).toEqual([other]);
    expect(CASE_POLICY_VERSION).toBe("source-evidence-v1");
  });
  it("분야가 같아도 내용이 무관하면 제외", () => {
    const c = buildEvidenceCase("123", original);
    if (!c) throw new Error("fixture missing");
    expect(selectEvidenceCases(c, [{ ...c, identity_keys: ["456"], evidence: ["자동차 엔진 냉각 장치"] }])).toEqual([]);
  });
  it("TRL은 기존 1~9 범위 밖이면 축적하지 않음", () => {
    expect(validateAnalysisResult("commercialization", "검증 결과".repeat(20), 10)).toBe(false);
    expect(validateAnalysisResult("commercialization", "검증 결과".repeat(20), 6)).toBe(true);
  });
});