// KIPRIS Plus 특허·실용신안 검색 서비스(patUtiModInfoSearchSevice) 클라이언트.
// 서비스 키는 서버에만 두고, 브라우저는 /api/* 를 통해서만 접근한다.
import { XMLParser } from "fast-xml-parser";

export const DEFAULT_BASE_URL = "https://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice";

// 행정처분 상태(lastvalue) 코드
export const STATUS = { ALL: "", OPEN: "A", WITHDRAWN: "C", EXPIRED: "F", ABANDONED: "G", INVALID: "I", REJECTED: "J", REGISTERED: "R" };

export class KiprisError extends Error {
  constructor(message, code) { super(message); this.name = "KiprisError"; this.code = code; }
}

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

const asArray = v => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const clean = s => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function findKey(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const r = findKey(v, key);
    if (r !== undefined) return r;
  }
  return undefined;
}

export function parseXml(text) {
  const doc = parser.parse(text);
  const res = doc.response ?? doc;
  const header = res.header ?? {};
  const code = String(header.resultCode ?? "").trim();
  if (String(header.successYN ?? "").toUpperCase() === "N" || (code && code !== "00")) {
    if (code === "20") return { empty: true, res };
    throw new KiprisError(`KIPRIS 오류 [${code || "?"}] ${clean(header.resultMsg) || "알 수 없는 오류"}`, code);
  }
  return { empty: false, res };
}

export function normalizeItem(it) {
  const applicationNumber = clean(it.applicationNumber);
  return {
    applicationNumber,
    title: clean(it.inventionTitle),
    applicant: clean(it.applicantName),
    applicationDate: clean(it.applicationDate),
    openNumber: clean(it.openNumber),
    openDate: clean(it.openDate),
    registerNumber: clean(it.registerNumber),
    registerDate: clean(it.registerDate),
    status: clean(it.registerStatus),
    ipc: clean(it.ipcNumber),
    abstract: clean(it.astrtCont),
    link: applicationNumber ? `https://doi.org/10.8080/${applicationNumber}` : null
  };
}

// KIPRIS 검색 결과에는 특허 출원 형식을 빌린 광고 문서(상표 등록 대행 광고 등: 전화번호·누리집 주소, 대개 취하)가 섞여 있다.
// 키워드를 잔뜩 넣어 두어 어떤 검색어에도 걸리므로 결과에서 뺀다
const AD_PATTERNS = [
  /\b0\d{1,2}-\d{3,4}-\d{4}\b|\b1[5-9]\d{2}-\d{4}\b/, // 전화번호 (02-1234-5678, 1833-8891)
  /https?:\/\/|www\.|\.(?:com|co\.kr|net)\b/i, // 누리집 주소
  /대표\s*전화|상담\s*전화|문의\s*전화|카카오톡|검색해\s*보세요|전국\s*1\s*위/,
  /상표\s*등록|상표권|상표\s*출원|무료\s*(?:상담|컨설팅)/
];
export const isAdDoc = it => { const t = `${it.title ?? ""} ${it.abstract ?? ""}`; return AD_PATTERNS.some(re => re.test(t)); };

export function normalizeDetail(item) {
  const pick = (arr, key) => asArray(item?.[arr]?.[key]);
  const summary = pick("biblioSummaryInfoArray", "biblioSummaryInfo")[0] ?? {};
  return {
    applicationNumber: clean(summary.applicationNumber),
    title: clean(summary.inventionTitle),
    status: clean(summary.registerStatus),
    finalDisposal: clean(summary.finalDisposal),
    claimCount: Number(clean(summary.claimCount)) || 0,
    claims: pick("claimInfoArray", "claimInfo").map(c => clean(c.claim)).filter(Boolean),
    legal: pick("legalStatusInfoArray", "legalStatusInfo").map(l => ({
      name: clean(l.documentName), code: clean(l.commonCodeName), date: clean(l.receiptDate)
    })),
    priorArt: pick("priorArtDocumentsInfoArray", "priorArtDocumentsInfo").map(p => ({
      number: clean(p.documentsNumber), byExaminer: /^(y|yes|1|심사관)/i.test(clean(p.examinerQuotationFlag))
    })),
    // 출원인(국적 포함)·대리인·IPC — 공개 서지정보
    applicants: pick("applicantInfoArray", "applicantInfo").map(a => ({ name: clean(a.name), country: clean(a.country).toUpperCase() })).filter(a => a.name),
    agents: pick("agentInfoArray", "agentInfo").map(a => ({ name: clean(a.name), code: clean(a.code) })).filter(a => a.name),
    ipc: pick("ipcInfoArray", "ipcInfo").map(i => clean(i.ipcNumber)).filter(Boolean)
  };
}

// 동의어 그룹 배열 → KIPRIS 검색식. [["쌀겨","미강"],["발효"]] → (쌀겨+미강)*발효
// 띄어 쓴 검색어("식감 개선")는 KIPRIS가 붙여 쓴 말("식감개선")로만 찾아 거의 걸리지 않으므로, 낱말로 나눠 AND 로 묶는다
export function buildQuery(groups, { andOp = "*", orOp = "+" } = {}) {
  const term = t => { const w = String(t).trim().split(/\s+/).filter(Boolean); return w.length > 1 ? `(${w.join(andOp)})` : w[0] ?? ""; };
  return groups
    .map(g => asArray(g).map(term).filter(Boolean))
    .filter(g => g.length)
    .map(g => (g.length > 1 ? `(${g.join(orOp)})` : g[0]))
    .join(andOp);
}

function limiter(n) {
  let active = 0; const queue = [];
  const next = () => { if (active >= n || !queue.length) return; active++; const { fn, ok, ko } = queue.shift(); fn().then(ok, ko).finally(() => { active--; next(); }); };
  return fn => new Promise((ok, ko) => { queue.push({ fn, ok, ko }); next(); });
}

export function createKipris({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  andOp = "*",
  orOp = "+",
  timeoutMs = 20000,
  cacheTtlMs = 6 * 3600 * 1000,
  concurrency = 4,
  // 출원일 범위 표기 (KIPRIS Plus 고급검색). 다르게 받는 경우 KIPRIS_DATE_RANGE 로 바꾼다
  dateFormat = "{from}~{to}"
} = {}) {
  if (!apiKey) throw new Error("KIPRIS_API_KEY 가 설정되지 않았습니다.");
  const cache = new Map();
  const limit = limiter(concurrency);
  let calls = 0;

  async function call(op, params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    const cacheKey = `${op}?${qs}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return hit.val;
    qs.set("ServiceKey", apiKey);
    const val = await limit(async () => {
      calls++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetchImpl(`${baseUrl}/${op}?${qs}`, { signal: ctrl.signal });
        if (!r.ok) throw new KiprisError(`KIPRIS HTTP ${r.status}`, `HTTP_${r.status}`);
        return parseXml(await r.text());
      } catch (e) {
        if (e.name === "AbortError") throw new KiprisError("KIPRIS 응답 시간이 초과되었습니다.", "TIMEOUT");
        throw e;
      } finally { clearTimeout(timer); }
    });
    cache.set(cacheKey, { val, exp: Date.now() + cacheTtlMs });
    return val;
  }

  async function search({ groups, ipc, status = STATUS.ALL, rows = 30, page = 1, applicationDate, applicant }) {
    const { empty, res } = await call("getAdvancedSearch", {
      astrtCont: buildQuery(groups, { andOp, orOp }),
      ipcNumber: ipc,
      applicationDate, applicant,
      lastvalue: status,
      patent: "true", utility: "true",
      numOfRows: rows, pageNo: page,
      sortSpec: "AD", descSort: "true"
    });
    if (empty) return { total: 0, items: [] };
    const all = asArray(res?.body?.items?.item).map(normalizeItem), items = all.filter(it => !isAdDoc(it));
    const total = Number(findKey(res, "totalCount")) || all.length;
    return { total, items, excluded: all.length - items.length };
  }

  const count = async (groups, ipc, extra = {}) => (await search({ groups, ipc, rows: 1, ...extra })).total;
  const dateRange = (from, to) => dateFormat.replace("{from}", from).replace("{to}", to);

  async function detail(applicationNumber) {
    const { empty, res } = await call("getBibliographyDetailInfoSearch", { applicationNumber });
    if (empty) return null;
    return normalizeDetail(res?.body?.item ?? {});
  }

  return { search, count, detail, dateRange, query: g => buildQuery(g, { andOp, orOp }), get calls() { return calls; } };
}
