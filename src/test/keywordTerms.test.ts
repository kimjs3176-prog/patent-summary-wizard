import { describe, it, expect } from "vitest";
import { cleanKeywordTerm } from "../../supabase/functions/_shared/keywordTerms";
import { sanitizeNlTerms } from "../../supabase/functions/search-patents/nlRelevance";
import { sanitizeTerms } from "../../supabase/functions/find-my-patents/finderPolicy";
import { sanitizeQuery } from "../../supabase/functions/patent-chat/chatPolicy";

describe("키워드 전용 조사 정리", () => {
  it("붙은 조사와 단독 연결어를 제거", () => {
    expect(cleanKeywordTerm("라이스 볼의 저장을 위한 기술" )).toBe("라이스 볼 저장 기술");
    expect(cleanKeywordTerm("딸기를 온실에서 재배" )).toBe("딸기 온실 재배");
  });
  it("정상 명사의 끝 글자는 유지", () => {
    const nouns = ["효과", "증가", "농가", "단가", "차이", "알로에", "가을", "마을", "저울", "종이", "곰팡이", "사과", "무화과"];
    for (const noun of nouns) expect(cleanKeywordTerm(noun)).toBe(noun);
  });
  it("검색·추천·상담 모두 동일하게 정리", () => {
    expect(sanitizeNlTerms(["딸기의", "저장을", "위한"])).toEqual(["딸기", "저장"]);
    expect(sanitizeTerms(["라이스 볼의"], [])).toEqual(["라이스 볼"]);
    expect(sanitizeQuery("딸기의 저장을")).toBe("딸기 저장");
  });
  it("굳지 않는 떡의 부정 조건은 유지", () => {
    expect(cleanKeywordTerm("굳지 않는 떡")).toBe("굳지 않는 떡");
  });
});