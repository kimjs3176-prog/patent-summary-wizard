// 공공데이터포털(data.go.kr) 연동
//   관세청 품목별 국가별 수출입실적 → 해외 사업화의 '시장별 한국 수출 실적' (내 기술 품목의 HS 코드 기준)
//   중소벤처기업부 기업마당 지원사업 공고 → 해외 사업화·출원지원 5단계의 '지금 신청할 수 있는 공고'
//   (산업동향 기사는 공공데이터가 아니라 네이버 뉴스 검색 또는 구글 뉴스 RSS 검색으로 가져온다 — 아래)
// 키는 DATA_GO_KR_SERVICE_KEY 환경변수에서 읽는다. 키가 없거나 KIPRIS_MOCK=1 이면 예시 데이터(mode: "sample")
export const PD_KEY = process.env.DATA_GO_KR_SERVICE_KEY || "";
const SAMPLE = !PD_KEY || process.env.KIPRIS_MOCK === "1";
const BASE = "https://apis.data.go.kr";
const DAY = 24 * 3600 * 1000;

// 제품 유형(해외 사업화의 BIZ_TYPES)별 대표 HS 코드 4단위
export const TRADE_HS = {
  food: ["2106", "조제 식료품"],
  functional: ["1302", "식물성 수액·추출물"],
  bio: ["3101", "동식물성 비료"],
  equip: ["8436", "농업·원예용 기계"],
  seed: ["1209", "파종용 종자"]
};
// 비교할 나라: [코드, 이름, 해외 사업화의 관심 시장 묶음]
export const TRADE_COUNTRIES = [["US", "미국", "US"], ["CN", "중국", "CN"], ["JP", "일본", "JP"], ["VN", "베트남", "SEA"], ["TH", "태국", "SEA"], ["ID", "인도네시아", "SEA"],
  ["MY", "말레이시아", "SEA"], ["PH", "필리핀", "SEA"], ["SG", "싱가포르", "SEA"], ["AE", "아랍에미리트", "ME"], ["SA", "사우디아라비아", "ME"], ["DE", "독일", "EU"],
  ["NL", "네덜란드", "EU"], ["FR", "프랑스", "EU"], ["AU", "호주", ""], ["CA", "캐나다", ""], ["IN", "인도", ""]];

const cache = new Map();
const cached = async (key, ms, fn) => {
  const c = cache.get(key); if (c && Date.now() - c.at < ms) return c.v;
  const v = await fn(); cache.set(key, { at: Date.now(), v }); return v;
};
async function get(url, { timeout = 15000, tries = 2 } = {}) {
  for (let i = 0; ; i++) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }
    catch (e) { if (i + 1 >= tries) throw e; }
    finally { clearTimeout(t); }
  }
}
const ym = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
const back = (d, n) => new Date(d.getFullYear(), d.getMonth() - n, 1);
// 최근 12개월과 그 전 12개월. 관세청 통계는 매월 15일쯤 전달까지 올라오므로 두 달 전까지 센다
export function tradePeriods(now = new Date()) {
  const end = back(now, 2);
  return { cur: [ym(back(end, 11)), ym(end)], prev: [ym(back(end, 23)), ym(back(end, 12))] };
}
const tag = (x, t) => x.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
// 응답의 '총계' 줄에서 수출 금액(달러)을 읽는다. 자료가 없으면 0, 오류면 null
export function parseTradeTotal(xml) {
  if (tag(xml, "resultCode") !== "00") return null;
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const tot = items.find(it => tag(it, "year") === "총계") ?? (items.length === 1 ? items[0] : null);
  return tot ? Number(tag(tot, "expDlr") || 0) : 0;
}
async function tradeOne(hs, c, [from, to]) {
  try { return parseTradeTotal(await get(`${BASE}/1220000/nitemtrade/getNitemtradeList?serviceKey=${PD_KEY}&strtYymm=${from}&endYymm=${to}&hsSgn=${hs}&cntyCd=${c}`)); }
  catch { return null; }
}
const growth = (a, b) => (a == null || !b ? null : Math.round((a - b) / b * 1000) / 10);

export const validateTrade = q => ({ type: TRADE_HS[q?.type] ? q.type : "food" });

// 내 기술 품목의 나라별 한국 수출 실적(최근 12개월)과 그 전 12개월 대비 증가율
export async function trade({ type }, now = new Date()) {
  const [hs, hsName] = TRADE_HS[type], period = tradePeriods(now);
  const base = { type, hs, hsName, period, source: "관세청 품목별 국가별 수출입실적 (공공데이터포털)" };
  if (SAMPLE) return { ...base, mode: "sample", rows: sampleTrade(type) };
  return cached(`trade:${type}:${period.cur[1]}`, DAY, async () => {
    const vals = await Promise.all(TRADE_COUNTRIES.flatMap(([c]) => [tradeOne(hs, c, period.cur), tradeOne(hs, c, period.prev)]));
    const rows = TRADE_COUNTRIES.map(([code, name, region], i) => ({ code, name, region, exp: vals[i * 2], prev: vals[i * 2 + 1], growth: growth(vals[i * 2], vals[i * 2 + 1]) }))
      .sort((a, b) => (b.exp ?? -1) - (a.exp ?? -1));
    const failed = rows.filter(r => r.exp == null).length;
    if (failed === rows.length) throw Object.assign(new Error("관세청 통계를 불러오지 못했습니다. 잠시 뒤 다시 시도하세요."), { status: 502 });
    return { ...base, mode: "live", rows, failed };
  });
}
// 예시: 실제 통계의 크기와 비슷하게 만든 값 (화면 구성용)
function sampleTrade(type) {
  const seed = [...type].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return TRADE_COUNTRIES.map(([code, name, region], i) => {
    const exp = Math.round(((seed * (i + 7)) % 97 + 3) * 210000 / (i + 1)), prev = Math.round(exp * (0.7 + ((seed + i * 13) % 60) / 100));
    return { code, name, region, exp, prev, growth: growth(exp, prev) };
  }).sort((a, b) => b.exp - a.exp);
}

/* ---------- 기업마당 지원사업 공고 ---------- */
// scope: global(수출·해외 진출) · ip(특허·지식재산) · overseas(해외 출원·등록 비용, 해외 IP 분쟁). 해시태그로 받아 지금 신청할 수 있는 것만 남기고, 농식품·지식재산과 가까운 순으로 고른다
const AGRI = /농|식품|푸드|스마트팜|종자|축산|비료|바이오/i;
const SCOPE = {
  global: { tags: ["수출"], topic: /특허|지식재산|IP|해외출원|해외규격|인증|기술수출|라이선스/i },
  ip: { tags: ["특허", "지식재산"], topic: /출원|특허|지식재산|IP/i },
  // 해외 출원 쪽에는 해외 출원·등록·IP 분쟁 공고만 (only: 주제에 맞지 않으면 뺀다)
  overseas: { tags: ["특허", "수출"], topic: /해외\s?(출원|등록|특허|OA|권리)|글로벌\s?IP|국제\s?특허|PCT|해외\s?지식재산|IP\s?위험|IP\s?분쟁|무단\s?선점/i, only: true }
};
export const validateNotices = q => ({ scope: SCOPE[q?.scope] ? q.scope : "global", region: String(q?.region ?? "").replace(/[^가-힣]/g, "").slice(0, 4) });
// 신청 기간 끝날짜가 지났으면 뺀다 ('상시', '예산 소진시까지' 등 날짜가 없으면 남김)
export function openNow(period, now = new Date()) {
  const d = String(period ?? "").match(/~\s*(\d{4})[-.](\d{2})[-.](\d{2})/);
  if (!d) return true;
  return new Date(+d[1], +d[2] - 1, +d[3], 23, 59) >= now;
}
const REGIONS = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
// 제목 앞 [지역] 표시: 내 지역이면 앞으로, 다른 지역 전용이면 뒤로
export function rankNotices(items, { scope, region }, now = new Date()) {
  const { topic, only } = SCOPE[scope];
  return items.filter(x => x.title && x.url && openNow(x.period, now) && (!only || topic.test(`${x.title} ${x.tags}`))).map(x => {
    const loc = x.title.match(/^\s*\[([^\]]+)\]/)?.[1] ?? "", text = `${x.title} ${x.tags}`;
    const local = loc ? (region && loc.includes(region) ? 2 : REGIONS.some(r => loc.includes(r)) ? -3 : 0) : 0;
    // 관련도(농식품 3점, 지식재산·해외 인증 2점, 제목에 있으면 1점 더)를 먼저 보고, 같으면 지역
    const rel = (AGRI.test(text) ? 3 : 0) + (topic.test(text) ? 2 : 0) + (topic.test(x.title) ? 1 : 0);
    return { ...x, score: rel * 10 + local };
  }).sort((a, b) => b.score - a.score || String(b.at).localeCompare(String(a.at)));
}
const pickNotice = x => ({ id: x.pblancId, title: x.pblancNm, url: x.pblancUrl, org: [x.jrsdInsttNm, x.excInsttNm].filter(Boolean).join(" · "), period: x.reqstBeginEndDe, target: x.trgetNm, tags: x.hashtags ?? "", at: x.creatPnttm });
async function noticesByTag(tag) {
  const all = [];
  for (let page = 1; page <= 3; page++) {
    const j = JSON.parse(await get(`${BASE}/1421000/bizinfo/pblancBsnsService?serviceKey=${PD_KEY}&dataType=json&numOfRows=100&pageNo=${page}&hashtags=${encodeURIComponent(tag)}`));
    const b = j?.response?.body; if (!b) throw new Error("응답 형식이 다릅니다");
    const it = b.items?.item ?? []; all.push(...(Array.isArray(it) ? it : [it]));
    if (all.length >= Number(b.totalCount || 0) || !it.length) break;
  }
  return all;
}
export async function notices({ scope, region }, now = new Date()) {
  const base = { scope, source: "기업마당 지원사업 공고 (중소벤처기업부, 공공데이터포털)", license: "공공누리 제3유형(출처표시·변경금지)" };
  if (SAMPLE) return { ...base, mode: "sample", items: rankNotices(sampleNotices(scope, now), { scope, region }, now).slice(0, 8) };
  const raw = await cached(`notices:${scope}`, 3 * 3600 * 1000, async () => {
    const lists = await Promise.all(SCOPE[scope].tags.map(t => noticesByTag(t).catch(() => null)));
    if (lists.every(l => !l)) throw Object.assign(new Error("기업마당 공고를 불러오지 못했습니다. 잠시 뒤 다시 시도하세요."), { status: 502 });
    const seen = new Set();
    return lists.flat().filter(Boolean).map(pickNotice).filter(x => x.id && !seen.has(x.id) && seen.add(x.id));
  });
  const items = rankNotices(raw, { scope, region }, now);
  return { ...base, mode: "live", total: items.length, items: items.slice(0, 8) };
}
function sampleNotices(scope, now) {
  const y = now.getFullYear(), d = n => { const t = new Date(now); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
  const list = scope !== "global"
    ? [["[예시] 글로벌 IP스타기업 해외출원비용 지원 공고", "지역지식재산센터", "특허,해외 특허,수출"], ["[예시] 농식품 기술 특허 출원 지원사업 모집", "농업기술실용화재단", "특허,농식품,지식재산"], ["[예시] IP 나래 프로그램 참여기업 모집", "한국발명진흥회", "특허,지식재산,창업"]]
    : [["[예시] K-푸드 해외 박람회 한국관 참가기업 모집", "한국농수산식품유통공사", "수출,식품,K-푸드"], ["[예시] 수출바우처 산업부 사업 참여기업 모집", "KOTRA", "수출,해외인증,특허"], ["[예시] 스마트팜 해외 실증 지원사업 공고", "농림축산식품부", "수출,스마트팜,실증"]];
  return list.map(([title, org, tags], i) => ({ id: `sample-${scope}-${i}`, title, url: "https://www.bizinfo.go.kr", org, period: `${d(-5)} ~ ${d(10 + i * 7)}`, target: "중소기업", tags, at: `${y}-01-0${i + 1}` }));
}

/* ---------- 산업동향 기사: 네이버 뉴스 검색(키가 있으면) 또는 구글 뉴스 RSS 검색(키 없이) ---------- */
// 키워드에 '수출·해외·시장'을 붙여 사업 기사만 찾고, 비슷한 제목(같은 보도자료를 받아쓴 기사)은 하나로 줄인다. 1시간 캐시
export const NAVER = { id: process.env.NAVER_CLIENT_ID || "", secret: process.env.NAVER_CLIENT_SECRET || "" };
export const validateNews = q => ({ kw: String(q?.kw ?? "").replace(/[<>"'&]/g, "").trim().slice(0, 60) });
const unesc = t => String(t ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const dateOf = v => { const d = new Date(v); return isNaN(d) ? "" : d.toISOString().slice(0, 10); };
// 제목의 두 글자 조각(바이그램)이 절반 가까이 겹치면 같은 이야기로 본다
const grams = t => { const c = unesc(t).replace(/[^가-힣A-Za-z0-9]/g, ""); const g = new Set(); for (let i = 0; i + 1 < c.length; i++) g.add(c.slice(i, i + 2)); return g; };
const similar = (a, b) => { if (!a.size || !b.size) return false; let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.min(a.size, b.size) >= 0.45; };
// 구글 뉴스 RSS: <item><title>제목 - 언론사</title><link/><pubDate/><source>언론사</source>
export function parseGoogleNews(xml) {
  return (String(xml).match(/<item>[\s\S]*?<\/item>/g) ?? []).map(it => {
    const g = t => (it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`)) || [])[1] ?? "";
    const source = unesc(g("source")), title = unesc(g("title")).replace(new RegExp(`\\s*[-|–]\\s*${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    return { title, date: dateOf(unesc(g("pubDate"))), source, url: unesc(g("link")), summary: "" };
  }).filter(x => x.title && x.url);
}
// 네이버 뉴스 검색: items[{title, originallink, link, description, pubDate}] (제목·설명에 <b> 강조가 섞여 온다)
export function parseNaverNews(json) {
  const j = typeof json === "string" ? JSON.parse(json) : json;
  return (j?.items ?? []).map(x => ({ title: unesc(x.title), date: dateOf(x.pubDate), source: (() => { try { return new URL(x.originallink || x.link).hostname.replace(/^www\./, ""); } catch { return ""; } })(), url: x.originallink || x.link || "", summary: unesc(x.description).slice(0, 200) })).filter(x => x.title && x.url);
}
export function dedupeNews(items, n = 8) {
  const kept = [], out = [];
  for (const x of items.sort((a, b) => b.date.localeCompare(a.date))) { const g = grams(x.title); if (kept.some(k => similar(k, g))) continue; kept.push(g); out.push(x); if (out.length >= n) break; }
  return out;
}
export async function news({ kw }, now = new Date()) {
  const q = `${kw} (수출 OR 해외 OR 시장)`;
  if (process.env.KIPRIS_MOCK === "1") return { kw, source: "예시", mode: "sample", items: sampleNews(kw, now) };
  if (NAVER.id && NAVER.secret) {
    const raw = await cached(`news:naver:${kw}`, 3600 * 1000, async () => {
      const r = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=30&sort=date`, { headers: { "X-Naver-Client-Id": NAVER.id, "X-Naver-Client-Secret": NAVER.secret } });
      if (!r.ok) throw Object.assign(new Error(`네이버 뉴스 검색 오류 (HTTP ${r.status})`), { status: 502 });
      return parseNaverNews(await r.json());
    });
    return { kw, source: "네이버 뉴스 검색", mode: "live", total: raw.length, items: dedupeNews(raw) };
  }
  const raw = await cached(`news:google:${kw}`, 3600 * 1000, async () => {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`, { headers: { "user-agent": "Mozilla/5.0 (agri-ip)" } });
    if (!r.ok) throw Object.assign(new Error(`구글 뉴스 검색 오류 (HTTP ${r.status})`), { status: 502 });
    return parseGoogleNews(await r.text());
  });
  return { kw, source: "구글 뉴스 검색", mode: "live", total: raw.length, items: dedupeNews(raw) };
}
// 예시 기사: 점검용(KIPRIS_MOCK=1). 제목에 [예시]를 붙여 실제 기사와 섞이지 않게 한다
function sampleNews(kw, now) {
  const d = n => { const t = new Date(now); t.setDate(t.getDate() - n); return t.toISOString().slice(0, 10); };
  return [
    { title: `[예시] ${kw} 수출, 동남아 시장에서 전년 대비 두 자릿수 성장`, date: d(6), source: "예시", url: "", summary: "할랄 인증과 현지 유통망 확보가 성장의 배경으로 꼽힙니다." },
    { title: `[예시] 미국 시장 ${kw} 수요 확대, 온라인 유통 비중 증가`, date: d(14), source: "예시", url: "", summary: "라벨링·FDA 등록 등 진입 요건을 미리 갖춘 기업이 늘고 있습니다." },
    { title: `[예시] 일본 유통사, 한국산 ${kw} 프리미엄 라인 입점 확대`, date: d(25), source: "예시", url: "", summary: "소포장·간편식 형태가 선호됩니다." }
  ];
}
