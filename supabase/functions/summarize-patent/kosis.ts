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

export const KOSIS_SERIES: KosisSeries[] = [
  { match: /^국내홍삼(건강기능식품)?시장$/, label: "국내 홍삼 건강기능식품 시장", c1Name: "홍삼", source: HFF_SRC, ...HFF },
  { match: /^국내프로바이오틱스(건강기능식품)?시장$/, label: "국내 프로바이오틱스 시장", c1Name: "프로바이오틱스", source: HFF_SRC, ...HFF },
  { match: /^국내(기능성)?건강기능식품시장$/, label: "국내 건강기능식품 시장", c1Name: "계", source: HFF_SRC, ...HFF },
  { match: /^국내쌀가공(식품)?시장$/, label: "국내 쌀가공식품 시장", c1Name: "전체", c2Name: "총계", source: RICE_SRC, ...RICE },
  { match: /^국내(전통)?떡(시장|산업)$/, label: "국내 떡 시장", c1Name: "전체", c2Name: "전통떡", source: RICE_SRC, ...RICE },
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
    `&orgId=${s.orgId}&tblId=${s.tblId}&itmId=${s.itmId}&objL1=ALL&prdSe=Y&newEstPrdCnt=6&format=json&jsonVD=Y&numOfRows=500`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.response?.body?.items?.item;
    const items: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const points = items
      .filter((i) => i.C1_NM === s.c1Name && i.ITM_ID === s.itmId && (!s.c2Name || (i.C2_NM ?? "").trim() === s.c2Name))
      .map((i) => ({ year: Number(i.PRD_DE), eok: Number(i.DT) * s.unitToEok }));
    const r = refFromSeries(points);
    if (!r) return null;
    return { market_key: key, label: s.label, base_year: r.baseYear, base_value_eok: r.baseEok, cagr: r.cagr, source: s.source };
  } catch (e) {
    console.error("[KOSIS] fetch failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}
