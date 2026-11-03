// 국가통계(KOSIS, 공공데이터포털 경유)로 국내 시장 표준값을 정한다.
// 등록된 시장은 AI가 쓴 숫자 대신 공식 통계의 최근 연도 값과 5년 CAGR을 사용한다.
import type { MarketRef } from "./marketConsistency.ts";

export interface KosisSeries {
  match: RegExp;          // normalizeMarketKey 결과에 대해 검사
  label: string;
  orgId: string;
  tblId: string;
  itmId: string;
  c1Name: string;         // 분류값 이름 (예: "계")
  c2Name?: string;        // 두 번째 분류값 이름 (있는 표만)
  unitToEok: number;      // 원 단위 값 → 억 원 배수
  source: string;
}

const HFF = { orgId: "145", tblId: "DT_145010_009", itmId: "T001", unitToEok: 1 / 100000 }; // 천원 → 억원
const HFF_SRC = "KOSIS 국가통계포털, 식품의약품안전처 「건강기능식품 매출액」";
// 쌀가공식품제조업 실태조사: 품목별 매출액 총계 (백만원 → 억원)
const RICE = { orgId: "466", tblId: "DT_446001_A024", itmId: "T002", unitToEok: 1 / 100 };
const RICE_SRC = "KOSIS 국가통계포털, 농림축산식품부 「쌀가공식품제조업 실태조사」";
// 식품 및 식품첨가물 생산실적: 식품유형별 국내판매액 (천원 → 억원)
const FOOD = { orgId: "145", tblId: "DT_145003_A001", itmId: "T001", c2Name: "국내판매액", unitToEok: 1 / 100000 };
const FOOD_SRC = "KOSIS 국가통계포털, 식품의약품안전처 「식품 및 식품첨가물 생산실적」(국내판매액)";
// 화장품 책임판매업체 생산실적 (백만원 → 억원), 유형별 생산실적 (억원)
const COS = { orgId: "145", tblId: "DT_145011_A004", itmId: "T003", unitToEok: 1 / 100 };
const COS_TYPE = { orgId: "145", tblId: "DT_145011_A013", itmId: "T001", unitToEok: 1 };
const COS_SRC = "KOSIS 국가통계포털, 식품의약품안전처 「화장품 생산실적」";
// 의료기기 생산·수출·수입액과 시장규모 (백만원 → 억원)
const MED = { orgId: "145", tblId: "DT_14508_007", itmId: "T001", unitToEok: 1 / 100 };
const MED_SRC = "KOSIS 국가통계포털, 식품의약품안전처 「의료기기 생산·수출·수입 실적」";

// 시장 이름은 통계 분류와 같은 범위일 때만 연결한다(넓거나 좁은 시장에 다른 분류 값을 붙이지 않는다).
export const KOSIS_SERIES: KosisSeries[] = [
  { match: /^국내홍삼(건강기능식품)?시장$/, label: "국내 홍삼 건강기능식품 시장", c1Name: "홍삼", source: HFF_SRC, ...HFF },
  { match: /^국내프로바이오틱스(건강기능식품)?시장$/, label: "국내 프로바이오틱스 시장", c1Name: "프로바이오틱스", source: HFF_SRC, ...HFF },
  { match: /^국내(기능성)?건강기능식품시장$/, label: "국내 건강기능식품 시장", c1Name: "계", source: HFF_SRC, ...HFF },
  { match: /^국내인삼건강기능식품시장$/, label: "국내 인삼 건강기능식품 시장", c1Name: "인삼", source: HFF_SRC, ...HFF },
  { match: /^국내개별인정형(원료)?(건강기능식품)?시장$/, label: "국내 개별인정형 건강기능식품 시장", c1Name: "개별인정제품", source: HFF_SRC, ...HFF },
  { match: /^국내(비타민및무기질|비타민·무기질|비타민)(건강기능식품)?시장$/, label: "국내 비타민·무기질 건강기능식품 시장", c1Name: "비타민 및 무기질", source: HFF_SRC, ...HFF },
  { match: /^국내(오메가3|오메가-3|EPA및DHA)(건강기능식품)?시장$/, label: "국내 오메가3(EPA·DHA) 건강기능식품 시장", c1Name: "EPA 및 DHA 함유 유지", source: HFF_SRC, ...HFF },
  { match: /^국내(루테인|마리골드꽃추출물)(건강기능식품)?시장$/, label: "국내 루테인(마리골드꽃추출물) 건강기능식품 시장", c1Name: "마리골드꽃추출물", source: HFF_SRC, ...HFF },
  { match: /^국내밀크씨슬(추출물)?(건강기능식품)?시장$/, label: "국내 밀크씨슬 건강기능식품 시장", c1Name: "밀크씨슬 추출물", source: HFF_SRC, ...HFF },
  { match: /^국내쌀가공(식품)?시장$/, label: "국내 쌀가공식품 시장", c1Name: "전체", c2Name: "총계", source: RICE_SRC, ...RICE },
  { match: /^국내(전통)?떡(시장|산업)$/, label: "국내 떡 시장", c1Name: "전체", c2Name: "전통떡", source: RICE_SRC, ...RICE },
  { match: /^국내음료(류)?시장$/, label: "국내 음료 시장", c1Name: "음료류", source: FOOD_SRC, ...FOOD },
  { match: /^국내(전통)?장류시장$/, label: "국내 장류 시장", c1Name: "장류", source: FOOD_SRC, ...FOOD },
  { match: /^국내주류시장$/, label: "국내 주류 시장", c1Name: "주류", source: FOOD_SRC, ...FOOD },
  { match: /^국내(식)?육가공(품|식품)?시장$/, label: "국내 식육가공품 시장", c1Name: "식육가공품 및 포장육", source: FOOD_SRC, ...FOOD },
  { match: /^국내유가공(품|식품)?시장$/, label: "국내 유가공품 시장", c1Name: "유가공품", source: FOOD_SRC, ...FOOD },
  { match: /^국내면류시장$/, label: "국내 면류 시장", c1Name: "면류", source: FOOD_SRC, ...FOOD },
  { match: /^국내두부(류)?시장$/, label: "국내 두부·묵류 시장", c1Name: "두부류 또는 묵류", source: FOOD_SRC, ...FOOD },
  { match: /^국내식용유(지)?(류)?시장$/, label: "국내 식용유지 시장", c1Name: "식용유지류", source: FOOD_SRC, ...FOOD },
  { match: /^국내조미(식품|료)시장$/, label: "국내 조미식품 시장", c1Name: "조미식품", source: FOOD_SRC, ...FOOD },
  { match: /^국내즉석식품(류)?시장$/, label: "국내 즉석식품 시장", c1Name: "즉석식품류", source: FOOD_SRC, ...FOOD },
  { match: /^국내특수의료용도식품시장$/, label: "국내 특수의료용도식품 시장", c1Name: "특수의료용도식품", source: FOOD_SRC, ...FOOD },
  { match: /^국내수산가공(식품|품)?(류)?시장$/, label: "국내 수산가공식품 시장", c1Name: "수산가공식품류", source: FOOD_SRC, ...FOOD },
  { match: /^국내농산(물)?가공(식품|품)?(류)?시장$/, label: "국내 농산가공식품 시장", c1Name: "농산가공식품류", source: FOOD_SRC, ...FOOD },
  { match: /^국내(벌꿀|꿀)(및화분)?(가공품)?(류)?시장$/, label: "국내 벌꿀·화분가공품 시장", c1Name: "벌꿀 및 화분가공품류", source: FOOD_SRC, ...FOOD },
  { match: /^국내화장품(산업)?시장$/, label: "국내 화장품 시장(생산실적)", c1Name: "데이터", source: COS_SRC, ...COS },
  { match: /^국내기초화장품시장$/, label: "국내 기초화장품 시장(생산실적)", c1Name: "기초화장용 제품류", source: COS_SRC, ...COS_TYPE },
  { match: /^국내의료기기(산업)?시장$/, label: "국내 의료기기 시장", c1Name: "시장규모", source: MED_SRC, ...MED },
];

export function findSeries(key: string): KosisSeries | null {
  return KOSIS_SERIES.find((s) => s.match.test(key)) ?? null;
}

/** 연도별 값(억 원)에서 최근 연도 값과 최대 5년 구간 CAGR(%)을 계산 */
export function refFromSeries(points: { year: number; eok: number }[]): { baseYear: number; baseEok: number; cagr: number } | null {
  const pts = points.filter((p) => Number.isFinite(p.eok) && p.eok > 0).sort((a, b) => a.year - b.year);
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const first = pts.find((p) => p.year >= last.year - 5) ?? pts[0];
  const n = last.year - first.year;
  if (n <= 0) return null;
  const cagr = Math.round((Math.pow(last.eok / first.eok, 1 / n) - 1) * 1000) / 10;
  return { baseYear: last.year, baseEok: Math.round(last.eok), cagr };
}

export async function fetchKosisRef(key: string, s: KosisSeries, serviceKey: string): Promise<MarketRef | null> {
  const url = `https://apis.data.go.kr/1240000/statisticsData/getStatisticsData?serviceKey=${serviceKey}` +
    // 분류가 많은 표(식품 생산실적 ≈1,200행, 쌀가공 ≈2,500행)도 한 번에 다 받도록 행 수를 넉넉히 준다
    `&orgId=${s.orgId}&tblId=${s.tblId}&itmId=${s.itmId}&objL1=ALL${s.c2Name ? "&objL2=ALL" : ""}&prdSe=Y&newEstPrdCnt=6&format=json&jsonVD=Y&numOfRows=5000`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    let res = await fetch(url, { signal: ctrl.signal });
    // 공공데이터포털은 초당 요청 수를 제한한다(429). 잠시 쉬고 한 번만 다시 묻는다.
    if (res.status === 429) {
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, 1500));
      res = await fetch(url, { signal: ctrl.signal });
    }
    if (!res.ok) {
      console.error(`[KOSIS] ${s.tblId} HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const raw = json?.response?.body?.items?.item;
    const items: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const points = items
      .filter((i) => (i.C1_NM ?? "").trim() === s.c1Name && i.ITM_ID === s.itmId && (!s.c2Name || (i.C2_NM ?? "").trim() === s.c2Name))
      .map((i) => ({ year: Number(i.PRD_DE), eok: Number(i.DT) * s.unitToEok }));
    const r = refFromSeries(points);
    if (!r) return null;
    return { market_key: key, label: s.label, base_year: r.baseYear, base_value_eok: r.baseEok, cagr: r.cagr, source: s.source, source_url: "https://kosis.kr", status: "official" };
  } catch (e) {
    console.error("[KOSIS] fetch failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}
