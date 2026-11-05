// 국내 출원 동향 (KIPRIS 실데이터): 해외동향·유망기술 지도의 기술분야별로
// 연도별 국내 출원 건수, 세부기술의 최근 5년·이전 5년 건수, 주요 출원인(최근 출원 100건 기준)을 KIPRIS Plus 로 센다.
// 분야당 약 23회 호출하며, 같은 요청은 kipris.js 캐시(6시간)를 쓴다.
import { STATUS } from "./kipris.js";
import { TREND_FIELDS } from "./trends.js";
import { topApplicants } from "./analyze.js";

// 초록 검색어: base(분야 전체, 묶음끼리 AND) + 세부기술별 묶음(TREND_FIELDS.subs 와 같은 순서). 같은 뜻의 말은 한 묶음에서 OR
export const KR_TERMS = {
  smartfarm: { base: [["스마트팜", "온실", "식물공장", "수직농장"]],
    subs: [["환경제어", "온습도", "환경 제어"], ["영상", "이미지", "인공지능", "딥러닝"], ["양액", "관수"], ["수직농장", "식물공장"], ["플랫폼", "빅데이터", "클라우드"]] },
  altprotein: { base: [["대체육", "대체단백", "배양육", "식물성고기", "식용곤충", "곤충단백"]],
    subs: [["식물성", "대두", "콩단백"], ["배양육", "세포배양"], ["곤충"], ["발효", "균사체", "미생물"], ["3D프린팅", "3차원", "적층"]] },
  biocontrol: { base: [["미생물비료", "생물농약", "미생물제제", "미생물농약", "생물학적방제", "토양미생물"]],
    subs: [["질소고정", "인산가용화"], ["생물농약", "방제"], ["토양개량"], ["생장촉진", "생육촉진"], ["바이오차"]] },
  foodferment: { base: [["발효식품", "기능성식품", "건강기능식품", "프로바이오틱스", "발효물"]],
    subs: [["프로바이오틱스", "유산균"], ["발효추출물", "발효물"], ["기능성", "건강기능"], ["저염", "저당", "나트륨저감"], ["맞춤형"]] },
  breeding: { base: [["품종", "육종", "유전자편집", "유전자가위", "형질전환식물"]],
    subs: [["유전자가위", "유전자편집", "CRISPR"], ["분자마커", "SNP"], ["내병성", "내한성", "내서성", "내건성"], ["고기능성", "기능성성분"], ["종자처리", "종자코팅"]] },
  robotics: { base: [["농업용로봇", "수확로봇", "농업용드론", "방제드론", "자율주행농기계", "농작업"]],
    subs: [["수확"], ["드론", "무인비행"], ["자율주행", "트랙터"], ["선별", "포장"], ["축사", "가축"]] },
  postharvest: { base: [["농산물", "과일", "채소", "청과"], ["저장", "선도", "신선도", "유통"]],
    subs: [["포장", "포장재"], ["CA저장", "기체조절", "MA포장"], ["콜드체인", "저온유통", "온도이력"], ["보존제", "천연항균"], ["선별", "등급", "비파괴"]] }
};

export function validateKr(q) {
  return { field: TREND_FIELDS[q?.field] ? q.field : "smartfarm" };
}

// 출원 후 1년 6개월 뒤 공개되므로 최근 2년은 덜 집계된다 (해외 동향 예시 데이터와 같은 기준)
const LAG_YEARS = 2;

export async function krTrends(k, { field }, { now = new Date(), mode = "live" } = {}) {
  const T = KR_TERMS[field], F = TREND_FIELDS[field], before = k.calls;
  const last = now.getFullYear() - 1, years = Array.from({ length: 10 }, (_, i) => last - 9 + i);
  const range = (a, b) => ({ applicationDate: k.dateRange(`${a}0101`, `${b}1231`) });
  const safe = p => p.catch(() => null);
  const [total, registered, latest, ...yearCounts] = await Promise.all([
    k.count(T.base), safe(k.count(T.base, "", { status: STATUS.REGISTERED })), safe(k.search({ groups: T.base, rows: 100 })),
    ...years.map(y => safe(k.count(T.base, "", range(y, y))))
  ]);
  // 연도 조건을 받지 않는 키·서버면 모든 해가 전체 건수와 같게 나온다 → 연도별 집계를 쓰지 않는다
  const yearsOk = yearCounts.some(c => c != null && c !== total);
  const subs = await Promise.all(T.subs.map(async (g, i) => {
    const q = [...T.base, g];
    if (!yearsOk) return { name: F.subs[i], total: await safe(k.count(q)), recent: null, prior: null, change: null };
    const [recent, prior] = await Promise.all([safe(k.count(q, "", range(last - 4, last))), safe(k.count(q, "", range(last - 9, last - 5)))]);
    return { name: F.subs[i], total: null, recent, prior, change: recent != null && prior ? Math.round((recent / prior - 1) * 100) : null };
  }));
  const full = yearsOk ? years.map((y, i) => [y, yearCounts[i]]).filter(([y, c]) => c != null && y <= last - LAG_YEARS) : [];
  const cagr = full.length >= 2 && full[0][1] > 0 ? Math.round(((full.at(-1)[1] / full[0][1]) ** (1 / (full.length - 1)) - 1) * 1000) / 10 : null;
  return {
    mode, source: "KIPRIS Plus", field, name: F.name,
    query: k.query(T.base),
    fetchedAt: new Date().toISOString(), apiCalls: k.calls - before,
    total, registered,
    years: yearsOk ? years : [], counts: yearsOk ? yearCounts : [], yearsOk,
    lagYears: years.slice(-LAG_YEARS), cagr, cagrSpan: full.length >= 2 ? [full[0][0], full.at(-1)[0]] : null,
    window: { recent: [last - 4, last], prior: [last - 9, last - 5] },
    subs,
    applicants: topApplicants(latest?.items ?? []), applicantBasis: latest?.items?.length ?? 0
  };
}

// 분야별 결과를 6시간 기억한다. 기억한 결과는 KIPRIS 를 다시 부르지 않으므로 호출 제한에서도 뺀다
const memo = new Map();
export const krCached = (field, mode) => { const m = memo.get(`${mode}:${field}`); return m && m.exp > Date.now() ? m.data : null; };
export async function krTrendsCached(k, input, opts = {}) {
  const hit = krCached(input.field, opts.mode);
  if (hit) return hit;
  const data = await krTrends(k, input, opts);
  memo.set(`${opts.mode}:${input.field}`, { data, exp: Date.now() + 6 * 3600 * 1000 });
  return data;
}
