// 글로벌 농식품 특허 동향: 기술분야 × 관청 × 연도 출원 건수, 세부기술, 주요 출원인, 떠오르는 키워드.
// 지금은 실제 API 연결 전의 예시 데이터(mode: "sample")를 만든다. 수치는 화면 구성을 보여 주기 위한 가상 값이며,
// EPO OPS·KIPRIS 해외특허 등 실제 API를 연결하면 같은 형태로 돌려주도록 이 모듈의 데이터 원천만 바꾼다.

export const OFFICES = { CN: "중국", US: "미국", EP: "유럽(EPO)", JP: "일본", KR: "한국" };

// 기술분야 정의: 실제 검색에 쓸 CPC/IPC 분류와 키워드를 함께 둔다
export const TREND_FIELDS = {
  smartfarm: { name: "스마트팜·정밀농업", cpc: ["A01G9/24", "A01G31", "A01B79", "G06Q50/02"],
    subs: ["환경 제어", "영상·AI 생육 진단", "양액·관수 자동화", "수직농장·식물공장", "농업 데이터 플랫폼"],
    kw: ["생육 예측 모델", "LED 광 레시피", "디지털 트윈 온실", "탄소 배출 저감 제어", "무인 양액 조제"] },
  altprotein: { name: "대체단백·배양육", cpc: ["A23J3", "A23L13", "C12N5/077"],
    subs: ["식물성 고기", "배양육", "곤충 단백", "미생물 발효 단백", "3D 프린팅 식품"],
    kw: ["정밀 발효 유청 단백", "지지체(스캐폴드)", "무혈청 배지", "고수분 압출", "마이코프로틴"] },
  biocontrol: { name: "미생물 비료·생물농약", cpc: ["C05F11/08", "A01N63", "C12N1/20"],
    subs: ["질소고정·인산가용화 균주", "생물농약", "토양 개량", "생장촉진 미생물(PGPR)", "바이오차 복합"],
    kw: ["미생물 컨소시엄", "내생균", "RNA 간섭 방제", "바이오 자극제", "캡슐화 제형"] },
  foodferment: { name: "발효·기능성 식품", cpc: ["A23L33", "A23L19", "C12N1/16"],
    subs: ["프로바이오틱스", "발효 추출물", "기능성 소재", "저염·저당 공정", "맞춤형 영양"],
    kw: ["포스트바이오틱스", "장-뇌 축", "혈당 조절 소재", "업사이클링 부산물", "개인 맞춤 식단"] },
  breeding: { name: "육종·유전자 편집", cpc: ["A01H", "C12N15/82", "C12N9/22"],
    subs: ["유전자 가위 작물", "분자 마커 육종", "내재해성 품종", "기능성 품종", "종자 처리"],
    kw: ["프라임 편집", "스피드 브리딩", "고온 내성", "유전체 선발", "무외래유전자 편집"] },
  robotics: { name: "농업 로봇·드론", cpc: ["A01B69", "A01D46", "A01M7", "B64U10"],
    subs: ["수확 로봇", "방제 드론", "자율주행 농기계", "선별·포장 로봇", "축사 자동화"],
    kw: ["엔드이펙터", "군집 드론", "작물 인식 비전", "정밀 변량 살포", "원격 관제"] },
  postharvest: { name: "수확 후 저장·유통", cpc: ["A23B7", "B65D81", "F25D"],
    subs: ["신선도 유지 포장", "CA 저장", "콜드체인 모니터링", "천연 보존제", "선별·등급 판정"],
    kw: ["가식성 코팅", "에틸렌 흡착", "시간-온도 지시계", "초분광 선별", "저온 플라즈마 살균"] }
};

// 문자열 → 재현 가능한 난수 (같은 분야는 항상 같은 예시 값)
const seedOf = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
function rng(seed) { let x = seed || 1; return () => (x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909), ((x ^= x >>> 16) >>> 0) / 4294967296); }

// 관청별 기본 규모(첫해 출원 건수)와 연 증가율 범위 — 예시 데이터의 성격을 정하는 값
const PROFILE = { CN: [520, 0.10, 0.18], US: [210, 0.03, 0.09], EP: [140, 0.02, 0.08], JP: [120, -0.02, 0.04], KR: [95, 0.04, 0.12] };
// 출원 후 1년 6개월 뒤 공개되므로 최근 2년은 적게 잡힌다 (실데이터에서도 같은 현상)
const LAG = { 1: 0.55, 2: 0.9 };

export function validateTrends(q) {
  const field = TREND_FIELDS[q.field] ? q.field : "smartfarm";
  const span = Number(q.years) === 5 ? 5 : 10;
  return { field, span };
}

export function sampleTrends({ field, span }, { now = new Date() } = {}) {
  const f = TREND_FIELDS[field], r = rng(seedOf(field));
  const last = now.getFullYear() - 1, years = Array.from({ length: span }, (_, i) => last - span + 1 + i);
  const all = Array.from({ length: 10 }, (_, i) => last - 9 + i);
  const series = {};
  for (const [o, [base, lo, hi]] of Object.entries(PROFILE)) {
    const g = lo + (hi - lo) * r(), scale = 0.6 + 0.8 * r();
    let v = base * scale;
    const full = all.map((y, i) => { if (i) v *= 1 + g + (r() - 0.5) * 0.08; const lag = LAG[last - y + 1] ?? 1; return Math.round(v * lag); });
    series[o] = full.slice(-span);
  }
  const total = o => series[o].reduce((a, b) => a + b, 0);
  // 세부기술: 관청마다 비중이 다르다
  const subs = f.subs.map((name, i) => {
    const byOffice = {};
    for (const o of Object.keys(OFFICES)) byOffice[o] = Math.round(total(o) * (0.08 + 0.32 * r()) / (1 + i * 0.15));
    return { name, byOffice, growth: Math.round((r() * 0.3 - 0.04) * 1000) / 10 };
  });
  // 예시 데이터에는 실제 기관명을 쓰지 않는다
  const kind = ["대학", "공공연구기관", "기업"], kinds = Object.fromEntries(Object.keys(OFFICES).map(o => [o, kind]));
  const applicants = Object.keys(OFFICES).flatMap(o => kinds[o].map((k, i) => ({ name: `${OFFICES[o]} ${k} ${String.fromCharCode(65 + i)}`, office: o, count: Math.round(total(o) * (0.02 + 0.05 * r())) })))
    .sort((a, b) => b.count - a.count).slice(0, 10);
  const keywords = f.kw.map(term => {
    const g = 0.05 + 0.5 * r(); let v = 8 + 30 * r();
    const spark = Array.from({ length: 6 }, (_, i) => Math.round(i ? (v *= 1 + g) : v));
    return { term, count: spark.slice(0, 5).reduce((a, b) => a + b, 0), growth: Math.round(g * 1000) / 10, spark: spark.slice(0, 5) };
  }).sort((a, b) => b.growth - a.growth);
  const notable = f.subs.slice(0, 4).map((s, i) => {
    const o = ["US", "CN", "EP", "JP"][i];
    return { title: `[예시] ${s} 관련 ${f.kw[i]} 기술`, office: o, year: last - (i % 2), applicant: `${OFFICES[o]} ${kinds[o][i % 3]} ${String.fromCharCode(65 + (i % 3))}` };
  });
  return { mode: "sample", field, name: f.name, cpc: f.cpc, years, lagYears: years.filter(y => LAG[last - y + 1]), offices: OFFICES, series, subs, applicants, keywords, notable };
}

// 화면에 보여 줄 요약 지표와 시사점은 데이터에서 계산한다 (예시든 실데이터든 같은 계산)
export function summarize(d) {
  const offices = Object.keys(d.series), sum = a => a.reduce((x, y) => x + y, 0);
  const totals = Object.fromEntries(offices.map(o => [o, sum(d.series[o])]));
  const grand = sum(Object.values(totals));
  // 증가율은 공개 지연이 없는 해까지만 본다
  const full = d.years.filter(y => !d.lagYears.includes(y)), i0 = d.years.indexOf(full[0]), i1 = d.years.indexOf(full.at(-1));
  const cagr = (a, b, n) => (a > 0 && n > 0 ? Math.round(((b / a) ** (1 / n) - 1) * 1000) / 10 : 0);
  const yearTotal = i => sum(offices.map(o => d.series[o][i]));
  const growth = Object.fromEntries(offices.map(o => [o, cagr(d.series[o][i0], d.series[o][i1], i1 - i0)]));
  const rank = [...offices].sort((a, b) => totals[b] - totals[a]);
  const share = o => Math.round(totals[o] / grand * 1000) / 10;
  const krShare = sub => { const t = sum(Object.values(sub.byOffice)); return t ? sub.byOffice.KR / t : 0; };
  const subsBy = [...d.subs].sort((a, b) => krShare(a) - krShare(b));
  const fastest = [...d.subs].sort((a, b) => b.growth - a.growth)[0];
  return {
    grand, totals, growth, rank, share: Object.fromEntries(offices.map(o => [o, share(o)])),
    cagrAll: cagr(yearTotal(i0), yearTotal(i1), i1 - i0), cagrSpan: [full[0], full.at(-1)],
    insights: [
      { t: "가장 빠르게 느는 세부기술", d: `${fastest.name} (연 ${fastest.growth}%)` },
      { t: "한국 비중이 낮은 세부기술", d: `${subsBy[0].name} — 한국 비중 ${Math.round(krShare(subsBy[0]) * 1000) / 10}%. 해외 선행기술이 많아 차별화 포인트를 먼저 확인하세요.` },
      { t: "출원이 가장 빨리 느는 관청", d: `${d.offices[Object.entries(growth).sort((a, b) => b[1] - a[1])[0][0]]} (연 ${Math.max(...Object.values(growth))}%)` },
      { t: "한국의 위치", d: `5개 관청 중 ${rank.indexOf("KR") + 1}위 · 점유 ${share("KR")}%` }
    ]
  };
}

export function trends(q, opts) {
  const d = sampleTrends(validateTrends(q), opts);
  return { ...d, summary: summarize(d) };
}
