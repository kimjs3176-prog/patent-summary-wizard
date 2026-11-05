// /api/explore 공통 로직 — 로컬 서버(server/server.js)와 Vercel 함수(api/*.js)가 함께 쓴다.
import { createKipris, KiprisError, STATUS, DEFAULT_BASE_URL } from "./kipris.js";
import { rankBySimilarity, keywordShare, frequentTerms, gapMatrix, inferRejection, rejectionSummary, suggestions, ipcFrequency, agentSummary, foreignApplicants } from "./analyze.js";
import { mockFetch } from "./mock.js";
import { draftEnabled } from "./draft.js";

export { KiprisError };
export const MOCK = process.env.KIPRIS_MOCK === "1";
const MAX_DETAIL = Number(process.env.KIPRIS_MAX_DETAIL || 5);
const SIM_DETAIL = Number(process.env.KIPRIS_SIMILAR_DETAIL || 5);
// 유사도가 이보다 낮은 문헌은 키워드 몇 개만 겹친 관계없는 문헌이라 목록·비교·인용에서 뺀다
const MIN_SIM = Number(process.env.KIPRIS_MIN_SIMILARITY || 5);
// 키워드를 모두 AND 로 묶은 검색이 이보다 적게 나오면 키워드를 하나씩 뺀 검색을 더해 후보를 넓힌다
const MIN_POOL = Number(process.env.KIPRIS_MIN_POOL || 30);

export const kipris = MOCK || process.env.KIPRIS_API_KEY
  ? createKipris({
      apiKey: MOCK ? "mock" : process.env.KIPRIS_API_KEY,
      baseUrl: process.env.KIPRIS_BASE_URL || DEFAULT_BASE_URL,
      fetchImpl: MOCK ? mockFetch : fetch,
      andOp: process.env.KIPRIS_AND_OP || "*",
      orOp: process.env.KIPRIS_OR_OP || "+",
      dateFormat: process.env.KIPRIS_DATE_RANGE || "{from}~{to}"
    })
  : null;

const terms = (v, max) => (Array.isArray(v) ? v : [])
  .map(t => String(t ?? "").trim().slice(0, 30)).filter(Boolean).slice(0, max);

export function validate(body) {
  const groups = (Array.isArray(body?.groups) ? body.groups : []).map(g => terms(g, 6)).filter(g => g.length).slice(0, 6);
  if (!groups.length) throw Object.assign(new Error("검색 키워드를 하나 이상 입력하세요."), { status: 400 });
  const axis = list => (Array.isArray(list) ? list : []).slice(0, 6)
    .map(a => ({ label: String(a?.label ?? "").slice(0, 40), terms: terms(a?.terms, 6) })).filter(a => a.label && a.terms.length);
  const ipc = String(body?.ipc ?? "").trim().slice(0, 20);
  return {
    ideaText: String(body?.ideaText ?? "").slice(0, 4000),
    groups,
    ipc: /^[A-H]\d{2}[A-Z]?(\s*\d+\/\d+)?$/i.test(ipc) ? ipc : "",
    rows: axis(body?.axes?.rows),
    cols: axis(body?.axes?.cols)
  };
}

export async function explore(k, input) {
  const { ideaText, groups, ipc, rows, cols } = input;
  const before = k.calls;
  const [sim, rej0] = await Promise.all([
    k.search({ groups, ipc, rows: 80 }),
    k.search({ groups, ipc, status: STATUS.REJECTED, rows: 20 })
  ]);
  // KIPRIS는 최신 출원순으로만 돌려준다. 정밀 검색이 적으면 그룹을 하나씩 뺀 검색(넓힌 검색)의 최신 문헌을 후보에 더한다
  const searches = [{ query: k.query(groups), total: sim.total, kind: "all" }];
  let pool = sim.items, rej = rej0, ads = sim.excluded ?? 0;
  if (sim.total < MIN_POOL && groups.length > 1) {
    const subsets = groups.map((_, i) => groups.filter((__, j) => j !== i));
    const wide = await Promise.all(subsets.map(g => k.search({ groups: g, ipc, rows: 50 }).catch(() => null)));
    subsets.forEach((g, i) => wide[i] && searches.push({ query: k.query(g), total: wide[i].total, kind: "wide" }));
    const seen = new Set(pool.map(it => it.applicationNumber));
    for (const r of wide) ads += r?.excluded ?? 0;
    for (const r of wide) for (const it of r?.items ?? []) if (!seen.has(it.applicationNumber)) { seen.add(it.applicationNumber); pool = [...pool, it]; }
    // 거절 출원도 정밀 검색에 적으면 가장 많이 나온 넓힌 검색으로 다시 찾는다
    const best = subsets.map((g, i) => [g, wide[i]?.total ?? -1]).sort((a, b) => b[1] - a[1])[0];
    if (rej0.total < 3 && best && best[1] > 0) {
      const r2 = await k.search({ groups: best[0], ipc, status: STATUS.REJECTED, rows: 20 }).catch(() => null);
      if (r2) rej = { total: rej0.total + r2.total, items: [...rej0.items, ...r2.items.filter(it => !rej0.items.some(x => x.applicationNumber === it.applicationNumber))] };
    }
  }
  const ranked = rankBySimilarity(ideaText, pool, groups), similar = ranked.filter(it => it.sim >= MIN_SIM);
  // 가장 비슷한 특허의 서지 상세: 대리인·출원인 국적 (공개 서지정보)
  const simTop = similar.slice(0, SIM_DETAIL);
  const simDetails = await Promise.all(simTop.map(it => k.detail(it.applicationNumber).catch(() => null)));

  const rejectedTop = rankBySimilarity(ideaText, rej.items.filter(i => !i.status || /거절/.test(i.status)), groups).filter(it => it.sim >= MIN_SIM).slice(0, MAX_DETAIL);
  const details = await Promise.all(rejectedTop.map(it => k.detail(it.applicationNumber).catch(() => null)));
  const cases = rejectedTop.map((it, i) => ({ ...it, history: details[i]?.legal ?? [], insight: inferRejection(details[i]) }));
  const rejected = { total: rej.total, cases, summary: rejectionSummary(cases) };

  let gap = null;
  if (rows.length && cols.length) {
    const counts = await Promise.all(rows.map(r => Promise.all(cols.map(c => k.count([r.terms, c.terms]).catch(() => null)))));
    gap = gapMatrix(rows.map(r => r.label), cols.map(c => c.label), counts);
  }

  const shares = keywordShare(groups, pool);
  const frequent = frequentTerms(ideaText, pool);
  return {
    mode: MOCK ? "mock" : "live",
    query: k.query(groups),
    fetchedAt: new Date().toISOString(),
    apiCalls: k.calls - before,
    similar: { total: sim.total, items: similar.slice(0, 20), low: ranked.length - similar.length, ads, minSim: MIN_SIM, pool: pool.length },
    searches,
    ipcs: ipcFrequency(pool), ipcBasis: pool.length,
    agents: agentSummary(simTop, simDetails),
    foreign: foreignApplicants(simTop, simDetails),
    shares, frequent, rejected, gap,
    suggestions: suggestions({ shares, frequent, gap, rejected, similar })
  };
}

// 간단한 IP별 호출 제한 (분당 10회) — KIPRIS 호출량 보호
const hits = new Map();
export function allowed(ip, max = 10) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= max) return false;
  list.push(now); hits.set(ip, list); return true;
}

export const health = () => ({ kipris: !!kipris, mode: kipris ? (MOCK ? "mock" : "live") : "off", draft: draftEnabled(), publicData: !!process.env.DATA_GO_KR_SERVICE_KEY });
