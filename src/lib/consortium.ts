/**
 * 식품기술이전 협의체 기관 (owner, 2026-11). 서버 목록 supabase/functions/_shared/consortiumOrgs.ts 와 같은 이름·순서
 * (src/test/consortium.test.ts 가 맞는지 본다). 기관별 특허는 consortium-patents 가 특허고객번호로 찾는다.
 */
export const CONSORTIUM_ORGS: string[] = [
  "국립낙동강생물자원관",
  "가천대학교 산학협력단",
  "강원대학교 산학협력단",
  "건국대학교 산학협력단",
  "건국대학교 글로컬산학협력단",
  "경기대학교 산학협력단",
  "경북대학교 산학협력단",
  "경상국립대학교 산학협력단",
  "경희대학교 산학협력단",
  "계명대학교 산학협력단",
  "고려대학교 산학협력단",
  "국립목포대학교 산학협력단",
  "군산대학교 산학협력단",
  "(재)금산인삼약초산업진흥원",
  "충남대학교 산학협력단",
  "충북대학교 산학협력단",
  "가톨릭관동대학교 산학협력단",
  "한국생명공학연구원",
  "한국식품연구원",
  "한국한의학연구원",
  "한림대학교 산학협력단",
  "한양대학교 산학협력단",
  "중앙대학교 산학협력단",
  "인제대학교 산학협력단",
  "국립부경대학교 산학협력단",
  "국립한국교통대학교 산학협력단",
  "한국발명진흥회",
  "서울여자대학교 산학협력단",
  "국립생태원",
  "㈜명지대학교 기술지주회사",
  "명지대학교 산학협력단",
  "단국대학교 산학협력단",
  "대구한의대학교 산학협력단",
  "동아대학교 산학협력단",
  "부산대학교 기술지주주식회사",
  "서울과학기술대학교 산학협력단",
  "세계김치연구소",
  "순천향대학교 산학협력단",
  "숙명여자대학교 산학협력단",
  "아주대학교 산학협력단",
  "연세대학교 기술지주회사",
  "연세대학교 미래캠퍼스 산학협력단",
  "영남대학교 산학협력단",
  "우석대학교 산학협력단",
  "원광대학교 산학협력단",
  "이화여자대학교 산학협력단",
  "인천대학교 산학협력단",
  "전남대학교 산학협력단",
  "전북대학교 산학협력단",
  "전주농생명소재연구원",
  "전주대학교 산학협력단",
  "제주대학교 산학협력단",
  "조선대학교 산학협력단",
];

export type ConsortiumKind = "univ" | "inst" | "holding";
export const CONSORTIUM_KIND_LABEL: Record<ConsortiumKind, string> = { univ: "대학 산학협력단", inst: "연구기관·공공기관", holding: "기술지주회사" };

export function consortiumKind(name: string): ConsortiumKind {
  if (/기술지주/.test(name)) return "holding";
  if (/대학/.test(name)) return "univ";
  return "inst";
}

export interface ConsortiumPatent {
  applicationNumber: string;
  registrationNumber?: string;
  title: string;
  applicationDate: string;
  registrationDate?: string;
  status: string;
  applicant: string;
  ipc?: string;
  abstract?: string;
}

export interface ConsortiumResult {
  org: string;
  codes: string[];
  total: number;
  page: number;
  hasMore: boolean;
  items: ConsortiumPatent[];
}

