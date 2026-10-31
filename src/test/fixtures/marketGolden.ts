// 관련시장 동향 후처리 골든 케이스.
// 실제 요약서에서 나온 형태의 단일 문단과 그 시점의 표준값(market_reference)을 넣고,
// 결과가 지켜야 할 불변식(기준값 ≤ 전망값, 수치마다 공식 출처 또는 (AI 추정치), 30% 초과 CAGR 미저장)과
// 사례별 기대 문구를 함께 둔다.
import type { MarketRef } from "../../../supabase/functions/summarize-patent/marketConsistency";

export interface MarketGoldenCase {
  name: string;
  targetYear: number;
  section: string;
  refs: MarketRef[];
  contains?: string[];
  notContains?: string[];
}

const KOSIS_HFF = "KOSIS 국가통계포털, 식품의약품안전처 「건강기능식품 매출액」";

export const MARKET_GOLDEN: MarketGoldenCase[] = [
  {
    name: "기준값만 바뀌고 다음 문장의 전망값이 남던 사례(F4)",
    targetYear: 2026,
    section:
      "본 기술의 상위 시장은 식용버섯 재배·가공 시장으로 정의할 수 있다. **국내 버섯 시장**은 2023년 약 900억 원 규모로 추정된다(한국농촌경제연구원, 2023). 이 시장은 연평균 6.5% 성장해 2026년 약 1,092억 원에 이를 전망이다(KREI 「농업전망 2024」, 2024). 또한 정부는 버섯 수출 확대를 위한 지원 사업을 추진하고 있다(농림축산식품부, 2024).",
    refs: [{ market_key: "국내버섯시장", label: "국내 버섯 시장", base_year: 2023, base_value_eok: 1500, cagr: 6.5, source: null, status: "ai_pending" }],
    contains: ["2023년 약 1,500억 원", "2026년 약 1,812억 원", "(농림축산식품부, 2024)"],
    notContains: ["1,092억", "한국농촌경제연구원", "KREI"],
  },
  {
    name: "국내·글로벌 시장이 한 문장에 있는 사례(F5)",
    targetYear: 2026,
    section:
      "국내 사료 시장은 2023년 약 10조 원이고 글로벌 사료 시장은 2023년 USD 4,000억 규모로 연평균 4.5% 성장하고 있다(Alltech, 2024). 국내 사료 시장은 연평균 3.0% 성장해 2026년 약 11조 원에 이를 전망이다.",
    refs: [
      { market_key: "국내사료시장", label: "국내 사료 시장", base_year: 2023, base_value_eok: 102000, cagr: 3.1, source: null, status: "ai_pending" },
    ],
    contains: ["10조 2,000억 원", "연평균 4.5%", "USD 4,000억", "2026년 약 11조 1,783억 원"],
    notContains: ["Alltech"],
  },
  {
    name: "범위 표기 + KOSIS 공식 통계",
    targetYear: 2026,
    section:
      "국내 건강기능식품 시장은 2023년 약 6조~6조 2,000억 원 수준이며(한국건강기능식품협회, 2023), 연평균 5.8% 성장해 2026년 약 7조 3,446억 원에 이를 것으로 전망된다. 특히 개별인정형 원료 비중이 확대되는 추세다.",
    refs: [{ market_key: "국내건강기능식품시장", label: "국내 건강기능식품 시장", base_year: 2024, base_value_eok: 40131, cagr: 6.3, source: KOSIS_HFF, status: "official" }],
    contains: ["2024년 약 4조 131억 원", "연평균 6.3%", "2026년 약 4조 5,347억 원", `(출처: ${KOSIS_HFF}, 2024년 기준)`],
    notContains: ["한국건강기능식품협회", "6조~"],
  },
  {
    name: "백만원 단위 + 본문 자체 수치로 전망값 정합",
    targetYear: 2026,
    section:
      "국내 곤충 사료 시장은 2023년 45,000백만 원 규모로 연평균 9.2% 성장하고 있으며, 2026년에는 약 400억 원 규모에 이를 것으로 예상된다(한국곤충산업협회, 2024).",
    refs: [],
    contains: ["2023년 450억 원", "2026년에는 약 586억 원"],
    notContains: ["한국곤충산업협회"],
  },
  {
    name: "글로벌 USD billion 표기와 '까지' 전망",
    targetYear: 2026,
    section:
      "세계 식물성 대체육 시장은 2023년 USD 6.1 billion 규모에서 2030년까지 연평균 19.3% 성장해 USD 20 billion에 이를 전망이다(Grand View Research, 2024).",
    refs: [],
    contains: ["USD 61억", "USD 209.8억"],
    notContains: ["Grand View Research"],
  },
  {
    name: "과도한 CAGR은 저장하지 않고 AI 추정치로만 표기",
    targetYear: 2026,
    section:
      "국내 스마트 양봉 시장은 2024년 약 300억 원으로 연평균 45% 급성장하고 있다(한국양봉협회, 2024). 2026년에는 약 631억 원에 이를 전망이다.",
    refs: [],
    contains: ["300억 원", "631억 원"],
    notContains: ["한국양봉협회"],
  },
  {
    name: "관리자 승인 표준값",
    targetYear: 2026,
    section:
      "국내 스마트팜 시장은 2022년 약 5,000억 원 규모이며 연평균 15% 성장해 2026년 약 8,745억 원 규모가 될 전망이다(스마트팜협회, 2023). 글로벌 스마트팜 시장은 2024년 약 USD 180억 규모다.",
    refs: [
      { market_key: "국내스마트팜시장", label: "국내 스마트팜 시장", base_year: 2023, base_value_eok: 6000, cagr: 10.5, source: "농림축산식품부 「스마트농업 육성정책 자료」(2024)", status: "approved" },
      { market_key: "글로벌스마트팜시장", label: "글로벌 스마트팜 시장", base_year: 2024, base_value_eok: 180, cagr: 13.4, source: null, status: "ai_pending" },
    ],
    contains: ["2023년 약 6,000억 원", "연평균 10.5%", "2026년 약 8,095억 원", "출처: 농림축산식품부 「스마트농업 육성정책 자료」 2024, 2023년 기준", "USD 180억 규모다(AI 추정치)"],
    notContains: ["스마트팜협회"],
  },
  {
    name: "'현재' 연도가 먼저 나오는 문장",
    targetYear: 2026,
    section:
      "국내 반려동물 사료 시장은 2026년 현재 약 2조 원 규모로 추정되며, 2024년 약 1조 8,000억 원에서 연평균 5.4% 성장한 결과다. 펫푸드 프리미엄화가 진행되고 있다(농림축산식품부, 2024).",
    refs: [],
    contains: ["2026년 현재 약 1조 9,996억 원", "2024년 약 1조 8,000억 원", "(농림축산식품부, 2024)"],
  },
];
