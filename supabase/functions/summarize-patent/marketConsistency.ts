// 관련시장 동향의 시장규모 수치를 같은 시장이면 항상 같은 값으로 고정하는 결정론적 보정기.
// 1) 시장명(라벨)부터 다음 시장명(또는 다른 통화 금액·섹션 끝)까지를 그 시장의 범위로 본다.
// 2) 범위 안의 기준연도·기준값·CAGR·전망연도 값을 표준값(market_reference) 하나로 함께 다시 쓴다.
// 3) 공식(KOSIS)·관리자 승인 표준값만 출처를 붙이고, 그 밖의 수치는 기관명 대신 "(AI 추정치)"로 표기한다.

export type MarketRefStatus = "official" | "approved" | "ai_pending";

export interface MarketRef {
  market_key: string;
  label: string;
  base_year: number;
  base_value_eok: number; // 국내: 억 원, 글로벌: USD 억
  cagr: number;           // %
  source?: string | null;
  source_url?: string | null;
  status?: MarketRefStatus | null;
  verified_at?: string | null;
}

export interface MarketClaim { label: string; key: string; baseYear: number; baseEok: number; cagr: number | null }

/** 새로 저장하는 AI 추정 CAGR의 상한(%). 범위를 벗어나면 저장하지 않는다. */
export const MAX_STORED_CAGR = 30;
export const AI_ESTIMATE_LABEL = "AI 추정치";
export const AI_ESTIMATE_NOTE = `(${AI_ESTIMATE_LABEL})`;

/** 한국 시간 기준 올해. 환산 기준연도와 "기준연도는 과거" 판정에 쓴다. */
export function currentSeoulYear(now: Date = new Date()): number {
  const y = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric" }).format(now));
  return Number.isFinite(y) && y > 2000 ? y : now.getUTCFullYear();
}

export function isOfficialSource(source: unknown): boolean {
  return /KOSIS|통계청/i.test(String(source ?? ""));
}

/** status 칼럼이 비어 있으면(마이그레이션 전 행) 출처로 신뢰 수준을 추정한다. */
export function refStatus(ref: Pick<MarketRef, "status" | "source">): MarketRefStatus {
  const s = ref.status;
  if (s === "official" || s === "approved" || s === "ai_pending") return s;
  return isOfficialSource(ref.source) ? "official" : "ai_pending";
}

/** 공식 통계·관리자 승인값이며 인용할 출처가 있으면 신뢰 표준값이다. */
export function isTrustedRef(ref: MarketRef): boolean {
  const st = refStatus(ref);
  const src = String(ref.source ?? "").trim();
  return (st === "official" || st === "approved") && !!src && src !== "USD";
}

// ---------- 금액 표기 ----------
const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;
const RANGE_SEP = String.raw`[~∼～〜\-–—]`;
const KRW_UNIT = String.raw`(?:조|억|천만|백만|만)`;
const KRW_UNIT_AMT = String.raw`${NUM}\s*${KRW_UNIT}(?:\s*${NUM}\s*${KRW_UNIT})*`;
/** 원화 금액(단일 또는 범위). 뒤에 "원"이 붙는 경우만 시장규모로 본다. */
const KRW_FIG = String.raw`(?:(?:${KRW_UNIT_AMT}|${NUM})\s*(?:원\s*)?${RANGE_SEP}\s*)?${KRW_UNIT_AMT}`;
const USD_UNIT = String.raw`(?:십억|억|billion|million|bn|mn)`;
const USD_PREFIX = String.raw`(?:USD|US\$|\$)`;
const USD_FIG = String.raw`(?:${USD_PREFIX}\s*${NUM}(?:\s*${USD_UNIT})?(?:\s*${RANGE_SEP}\s*(?:${USD_PREFIX}\s*)?${NUM}(?:\s*${USD_UNIT})?)?|${NUM}(?:\s*${USD_UNIT})?\s*${RANGE_SEP}\s*${NUM}\s*${USD_UNIT}\s*(?:달러|USD)|${NUM}\s*${USD_UNIT}\s*(?:달러|USD))`;

const KRW_MONEY_RE = new RegExp(String.raw`(${KRW_FIG})\s*원`, "g");
const USD_MONEY_RE = new RegExp(USD_FIG, "gi");

const KRW_MULT: Record<string, number> = { 조: 10000, 억: 1, 천만: 0.1, 백만: 0.01, 만: 0.0001 };
const round4 = (v: number) => Math.round(v * 10000) / 10000;

function parseKrwSingle(s: string): number | null {
  const t = s.replace(/\s+/g, "").replace(/원$/, "");
  if (!/^(?:\d[\d,]*(?:\.\d+)?(?:조|억|천만|백만|만))+$/.test(t)) return null;
  let total = 0;
  for (const m of t.matchAll(/(\d[\d,]*(?:\.\d+)?)(조|억|천만|백만|만)/g)) total += parseFloat(m[1].replace(/,/g, "")) * KRW_MULT[m[2]];
  return total > 0 ? round4(total) : null;
}

/** "1,000~1,200억", "1,000억 원~1,200억", "950만", "1,200백만" → {lo, hi} (억 원) */
export function parseKrwRange(s: string): { lo: number; hi: number } | null {
  const t = s.replace(/\s+/g, "").replace(/원$/, "");
  const parts = t.split(/[~∼～〜\-–—]/);
  if (parts.length === 1) {
    const v = parseKrwSingle(t);
    return v == null ? null : { lo: v, hi: v };
  }
  if (parts.length !== 2) return null;
  const hi = parseKrwSingle(parts[1]);
  if (hi == null) return null;
  const left = parts[0].replace(/원$/, "");
  let lo = parseKrwSingle(left);
  if (lo == null && /^\d[\d,]*(?:\.\d+)?$/.test(left)) {
    // 단위가 없는 하한은 상한의 마지막 단위를 따른다 (1,000~1,200억 → 1,000억)
    const unit = [...parts[1].matchAll(/(조|억|천만|백만|만)/g)].pop()?.[1] ?? "억";
    lo = round4(parseFloat(left.replace(/,/g, "")) * KRW_MULT[unit]);
  }
  if (lo == null || !(lo > 0)) return null;
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}

/** 원화 금액(억 원). 범위면 하한을 쓴다. */
export function parseKrwEok(s: string): number | null {
  return parseKrwRange(s)?.lo ?? null;
}

export function formatKrwEok(eok: number): string {
  if (eok < 100) {
    const man = Math.round(eok * 10000);
    const e = Math.floor(man / 10000);
    const r = man % 10000;
    if (e === 0) return `${r.toLocaleString("en-US")}만`;
    if (r === 0) return `${e}억`;
    return `${e}억 ${r.toLocaleString("en-US")}만`;
  }
  const v = Math.round(eok);
  const jo = Math.floor(v / 10000);
  const rest = v % 10000;
  if (jo === 0) return `${rest.toLocaleString("en-US")}억`;
  if (rest === 0) return `${jo}조`;
  return `${jo}조 ${rest.toLocaleString("en-US")}억`;
}

/** 기준값에 CAGR을 복리로 적용한 toYear 값 (억 원). toYear가 기준연도보다 앞서면 역산한다. */
export function projectEok(base: number, cagr: number, fromYear: number, toYear: number = currentSeoulYear()): number {
  const v = base * Math.pow(1 + cagr / 100, toYear - fromYear);
  return v >= 100 ? Math.round(v) : round4(v);
}

const USD_MULT = (u: string) => {
  const k = u.toLowerCase();
  return k === "십억" || k === "billion" || k === "bn" ? 10 : k === "million" || k === "mn" ? 0.01 : 1;
};

/** USD 금액 → 'USD 억' 단위 {lo, hi}. 범위면 하한·상한 모두 돌려준다. */
export function parseUsdRange(s: string): { lo: number; hi: number } | null {
  const t = s.replace(/\s+/g, "").replace(/^(?:USD|US\$|\$)/i, "").replace(/(?:달러|USD)$/i, "");
  const parts = t.split(/[~∼～〜\-–—]/).map((p) => p.replace(/^(?:USD|US\$|\$)/i, ""));
  if (parts.length > 2) return null;
  const one = (p: string, fallbackUnit?: string) => {
    const m = p.match(/^([\d,]+(?:\.\d+)?)(십억|억|billion|million|bn|mn)?$/i);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    const v = n * USD_MULT(m[2] || fallbackUnit || "억");
    return Math.round(v * 10) / 10;
  };
  const hiUnit = parts[parts.length - 1].match(/(십억|억|billion|million|bn|mn)$/i)?.[1];
  const hi = one(parts[parts.length - 1]);
  const lo = parts.length === 2 ? one(parts[0], hiUnit) : hi;
  if (hi == null || lo == null || !(lo > 0)) return null;
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}

export function parseUsdEok(s: string): number | null {
  return parseUsdRange(s)?.lo ?? null;
}

export function formatUsdEok(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `USD ${r.toLocaleString("en-US", { maximumFractionDigits: 1 })}억`;
}

function projectUsd(base: number, cagr: number, fromYear: number, toYear: number): number {
  return Math.round(base * Math.pow(1 + cagr / 100, toYear - fromYear) * 10) / 10;
}

// ---------- 시장명 ----------
export function normalizeMarketKey(name: string): string {
  return name.replace(/\s+/g, "").replace(/(규모|전체)/g, "").replace(/^대한민국|^한국/, "국내");
}

export function globalKey(label: string): string {
  return label.replace(/\s+/g, "").replace(/(규모|전체)/g, "").replace(/^(세계|전세계)/, "글로벌");
}

/** "국내 시장", "국내 상위 시장", "관련 시장"처럼 무엇인지 불분명한 시장명 */
export function isAmbiguousMarket(key: string): boolean {
  const core = key.replace(/^(국내|글로벌|세계|전세계|한국)/, "").replace(/시장$/, "");
  return core.length < 2 || /상위|관련|해당|전방|목표|대상|유관|기타/.test(core);
}

type LabelKind = "domestic" | "global" | "other" | "generic";
interface Label { start: number; end: number; text: string; kind: LabelKind; key: string; core: string }

// 시장명 뒤에는 조사(은/는/이/가/의/에서 …)가 와야 시장명으로 본다. "**…시장**은"처럼 볼드도 허용.
const LABEL_END_RE = /시장(?=(?:\s*규모)?\**\s*(?:(?:은|는|도|이|가|의|에서|에|을|를)[\s*]|(?:약\s*)?\d))/g;
const VERBISH = /(?:[는은한된할될던을를며에의로]|에서)$/;
const PREFIX_RE = /^(?:국내|한국|글로벌|세계|전세계|해외|국내외)$/;
const STOP_WORDS = new Set(["이", "그", "중", "이중", "그중", "해당", "동", "본", "상기", "전체", "관련", "이러한", "이와", "같은", "가운데"]);

function findLabels(text: string): Label[] {
  const out: Label[] = [];
  for (const m of text.matchAll(LABEL_END_RE)) {
    const end = m.index! + 2;
    const from = Math.max(0, m.index! - 48);
    let seg = text.slice(from, m.index!);
    const cut = Math.max(...[".", "。", ",", ";", "(", ")", "「", "」", "\n", ":", "\"", "'", "~"].map((c) => seg.lastIndexOf(c)));
    const segStart = from + cut + 1;
    seg = text.slice(segStart, m.index!);
    const words = [...seg.matchAll(/\S+/g)].map((w) => {
      const lead = w[0].match(/^\**/)![0].length;
      return { text: w[0].replace(/\*/g, ""), start: segStart + w.index! + lead };
    });
    const run: typeof words = [];
    for (let i = words.length - 1; i >= 0 && run.length < 5; i--) {
      const w = words[i].text;
      if (!/^[가-힣A-Za-z·]+$/.test(w) || VERBISH.test(w)) break;
      run.unshift(words[i]);
    }
    let pi = -1;
    for (let i = run.length - 1; i >= 0; i--) if (PREFIX_RE.test(run[i].text)) { pi = i; break; }
    let kind: LabelKind;
    let words2: typeof run;
    if (pi >= 0) {
      const p = run[pi].text;
      const startIdx = p === "세계" && pi > 0 && run[pi - 1].text === "전" ? pi - 1 : pi;
      words2 = run.slice(startIdx);
      kind = /^(?:국내|한국)$/.test(p) ? "domestic" : /^(?:글로벌|세계|전세계)$/.test(p) ? "global" : "other";
    } else {
      let si = 0;
      run.forEach((w, i) => { if (STOP_WORDS.has(w.text)) si = i + 1; });
      words2 = run.slice(si).slice(-2);
      if (!words2.length) continue; // "해당 시장은"처럼 앞 시장을 가리키는 표현
      kind = "generic";
    }
    const start = words2.length ? words2[0].start : m.index!;
    const labelText = text.slice(start, end).replace(/\*/g, "").replace(/\s+/g, " ").trim();
    const key = kind === "domestic" ? normalizeMarketKey(labelText) : kind === "global" ? globalKey(labelText) : labelText.replace(/\s+/g, "");
    const core = key.replace(/^(국내외|국내|한국|글로벌|세계|전세계|해외)/, "");
    out.push({ start, end, text: labelText, kind, key, core });
  }
  return out;
}

function isBoundary(cur: Label, next: Label): boolean {
  if (next.kind === "generic") return next.core !== cur.core;
  // "국내 관련 시장", "국내 해당 시장"처럼 지역만 붙은 지시 표현은 앞 시장을 다시 가리킨다.
  // 새 시장으로 끊으면 그 문장의 환산값이 표준값·출처 보정에서 빠져 같은 시장이 다른 숫자로 남는다.
  // ("국내 콩가공품 상위 시장"처럼 고유한 이름이 붙은 시장은 여전히 별개 시장으로 본다.)
  if (next.kind === cur.kind && /^(?:관련|해당|동|이|같은)?시장$/.test(next.core)) return false;
  return next.kind !== cur.kind || next.core !== cur.core;
}

// ---------- 연도-금액 쌍과 CAGR ----------
interface Pair { year: number; yearStart: number; yearEnd: number; figStart: number; figEnd: number; lo: number; hi: number }
interface Cagr { phraseStart: number; numStart: number; numEnd: number; lo: number; hi: number | null; ambiguous: boolean }

const YEAR_RE = /((?:19|20)\d{2})\s*년(?:도)?/g;
const GAP = String.raw`((?:[^.。\d]|\d+(?:\.\d+)?\s*%){0,40}?)`;
const KRW_PAIR_RE = new RegExp(String.raw`((?:19|20)\d{2})\s*년(?:도)?${GAP}((?:약|대략|추정)\s*)?(${KRW_FIG})\s*원`, "y");
const USD_PAIR_RE = new RegExp(String.raw`((?:19|20)\d{2})\s*년(?:도)?${GAP}((?:약|대략|추정)\s*)?(${USD_FIG})`, "iy");
// 시장규모가 아닌 금액(수출액·예산 등)과 시장규모를 섞지 않는다.
const NON_MARKET_GAP = /수출|수입|매출|생산액|투자|예산|지원|사업비|연구비|R&D|정부|1인당|가구당/;

function findPairs(text: string, from: number, to: number, currency: "krw" | "usd"): Pair[] {
  const re = currency === "krw" ? KRW_PAIR_RE : USD_PAIR_RE;
  const out: Pair[] = [];
  const seg = text.slice(0, to);
  for (const y of seg.matchAll(YEAR_RE)) {
    if (y.index! < from) continue;
    re.lastIndex = y.index!;
    const m = re.exec(seg);
    if (!m) continue;
    const gap = m[2] || "";
    if (NON_MARKET_GAP.test(gap) || /(?:19|20)\d{2}\s*년/.test(gap)) continue;
    const fig = m[4];
    const figStart = m.index + m[0].lastIndexOf(fig);
    const range = currency === "krw" ? parseKrwRange(fig) : parseUsdRange(fig);
    if (!range) continue;
    const yearText = y[0];
    out.push({ year: Number(m[1]), yearStart: y.index!, yearEnd: y.index! + yearText.length, figStart, figEnd: figStart + fig.length, lo: range.lo, hi: range.hi });
  }
  // 같은 금액을 두 연도가 공유하면 금액에 가까운 쪽(뒤쪽 연도)만 남긴다.
  return out.filter((p, i) => !out.some((q, j) => j > i && q.figStart === p.figStart));
}

const CAGR_A = /(연평균(?:\s*성장률)?|CAGR)([^.。%\d]{0,20}?)(\d+(?:\.\d+)?)(?:\s*%?\s*[~∼～〜\-–]\s*(\d+(?:\.\d+)?))?\s*%(?!\s*p)/gi;
const CAGR_B = /(\d+(?:\.\d+)?)(?:\s*%?\s*[~∼～〜\-–]\s*(\d+(?:\.\d+)?))?\s*%\s*(?:의\s*)?(?:연평균\s*(?:성장률|성장)|CAGR)/gi;

function findCagrs(text: string, from = 0, to = text.length): Cagr[] {
  const seg = text.slice(0, to);
  const out: Cagr[] = [];
  for (const m of seg.matchAll(CAGR_A)) {
    if (m.index! < from) continue;
    const numStart = m.index! + m[1].length + m[2].length;
    const numText = m[0].slice(m[1].length + m[2].length).replace(/\s*%$/, "");
    const after = seg.slice(m.index! + m[0].length, m.index! + m[0].length + 12);
    const ambiguous = /각각|순서대로/.test(m[2]) || /^\s*(?:,|및|와|과|에서|→)\s*\d+(?:\.\d+)?\s*%/.test(after);
    out.push({ phraseStart: m.index!, numStart, numEnd: numStart + numText.length, lo: parseFloat(m[3]), hi: m[4] ? parseFloat(m[4]) : null, ambiguous });
  }
  for (const m of seg.matchAll(CAGR_B)) {
    if (m.index! < from) continue;
    if (out.some((c) => c.numStart <= m.index! && m.index! < c.numEnd + 2)) continue;
    const numText = m[0].match(/^[\d.\s%~∼～〜\-–]+?(?=\s*%\s*(?:의\s*)?(?:연평균|CAGR))/i)?.[0] ?? m[1];
    out.push({ phraseStart: m.index!, numStart: m.index!, numEnd: m.index! + numText.length, lo: parseFloat(m[1]), hi: m[2] ? parseFloat(m[2]) : null, ambiguous: false });
  }
  return out.sort((a, b) => a.numStart - b.numStart);
}

/** CAGR 앞 15자 안에 다른 지역 시장 표현이 있으면 그 시장의 성장률로 본다. */
function isForeignCagr(text: string, c: Cagr, kind: "domestic" | "global"): boolean {
  const pre = text.slice(Math.max(0, c.phraseStart - 15), c.phraseStart);
  const head = pre.slice(Math.max(...[".", "。", ",", ";"].map((p) => pre.lastIndexOf(p))) + 1);
  return kind === "domestic" ? /글로벌|세계|해외/.test(head) : /국내|한국/.test(head);
}

function sentenceEnd(text: string, from: number): number {
  const rel = text.slice(from).search(/[.。](\s|$)/);
  return rel < 0 ? text.length : from + rel;
}

interface Scope { label: Label; start: number; end: number; base: Pair | null; pairs: Pair[]; cagrs: Cagr[] }

const SUBMARKET_SENTENCE = /[.。]\s+\**\s*(?:이\s*중|이\s*가운데|그\s*중|그중|이중|세부\s*시장|하위\s*시장)/;

/** 한 종류(국내/글로벌) 시장마다 범위·연도-금액 쌍·CAGR을 구한다. 같은 시장의 재언급은 한 범위로 이어진다. */
export function analyzeMarketScopes(text: string, kind: "domestic" | "global", targetYear: number = currentSeoulYear()): Scope[] {
  const labels = findLabels(text);
  const currency = kind === "domestic" ? "krw" : "usd";
  const scopes: Scope[] = [];
  let covered = -1;
  for (const label of labels) {
    if (label.kind !== kind || label.start < covered) continue;
    let end = text.length;
    for (const l of labels) if (l.start >= label.end && isBoundary(label, l)) { end = l.start; break; }
    const rest = text.slice(label.end, end);
    // 국내 범위는 다음 USD 금액에서, 글로벌 범위는 다음 원화 연도-금액에서 끊는다.
    let cur = -1;
    if (kind === "domestic") { USD_MONEY_RE.lastIndex = 0; const u = USD_MONEY_RE.exec(rest); cur = u ? u.index : -1; }
    else { const k = findPairs(text, label.end, end, "krw")[0]; cur = k ? k.yearStart - label.end : -1; }
    if (cur >= 0) end = label.end + cur;
    const sub = text.slice(label.end, end).search(SUBMARKET_SENTENCE);
    if (sub >= 0) end = label.end + sub + 1;
    const pairs = findPairs(text, label.end, end, currency);
    const sEnd = sentenceEnd(text, label.end);
    const base = pairs.find((p) => p.yearStart < sEnd && p.year < targetYear) ?? null;
    const cagrs = findCagrs(text, label.start, end).filter((c) => !isForeignCagr(text, c, kind));
    scopes.push({ label, start: label.start, end, base, pairs, cagrs });
    covered = end;
  }
  return scopes;
}

function claimCagr(scope: Scope): number | null {
  if (!scope.cagrs.length || scope.cagrs.some((c) => c.ambiguous || c.hi != null)) return null;
  const values = [...new Set(scope.cagrs.map((c) => c.lo))];
  return values.length === 1 ? values[0] : null;
}

function extractClaims(section: string, kind: "domestic" | "global", targetYear: number): MarketClaim[] {
  const out: MarketClaim[] = [];
  const seen = new Set<string>();
  for (const s of analyzeMarketScopes(section, kind, targetYear)) {
    if (!s.base || seen.has(s.label.key)) continue;
    seen.add(s.label.key);
    out.push({ label: s.label.text, key: s.label.key, baseYear: s.base.year, baseEok: s.base.lo, cagr: claimCagr(s) });
  }
  return out;
}

/** 섹션에 등장하는 모든 국내(원화) 시장 주장을 시장별로 추출한다. 기준연도는 올해보다 과거여야 한다. */
export function extractMarketClaims(section: string, targetYear: number = currentSeoulYear()): MarketClaim[] {
  return extractClaims(section, "domestic", targetYear);
}
export function extractMarketClaim(section: string, targetYear?: number): MarketClaim | null {
  return extractMarketClaims(section, targetYear)[0] ?? null;
}
/** 섹션에 등장하는 모든 글로벌(USD) 시장 주장을 시장별로 추출한다. */
export function extractGlobalClaims(section: string, targetYear: number = currentSeoulYear()): MarketClaim[] {
  return extractClaims(section, "global", targetYear);
}
export function extractGlobalClaim(section: string, targetYear?: number): MarketClaim | null {
  return extractGlobalClaims(section, targetYear)[0] ?? null;
}

/** AI가 쓴 시장 주장을 '검증 전(ai_pending)' 표준값 후보로 만든다. 출처는 저장하지 않는다. */
export function claimToRef(c: MarketClaim): MarketRef | null {
  if (c.cagr == null || !(c.cagr > 0) || c.cagr > MAX_STORED_CAGR) return null;
  if (!(c.baseEok > 0) || isAmbiguousMarket(c.key)) return null;
  return { market_key: c.key, label: c.label, base_year: c.baseYear, base_value_eok: c.baseEok, cagr: c.cagr, source: null, status: "ai_pending" };
}

/**
 * 시장 키에 맞는 신뢰 표준값(공식·승인)을 고른다. 같은 키의 값이 검증 전(ai_pending)이거나 없더라도,
 * 신뢰 표준값 가운데 시장명(label)이 같거나 같은 공식 통계표(sameSeries)를 쓰는 값이 있으면 그 값을 이 키로 쓴다.
 * (예전 규칙의 키로 저장된 KOSIS 값을 못 찾아 같은 시장이 "(AI 추정치)"로 표기되던 문제를 막는다)
 */
export function pickTrustedRef(key: string, current: MarketRef | undefined, trusted: MarketRef[], sameSeries?: (a: string, b: string) => boolean): MarketRef | undefined {
  if (current && isTrustedRef(current)) return current;
  const ok = trusted.filter(isTrustedRef);
  const hit = ok.find((t) => t.market_key === key)
    ?? ok.find((t) => normalizeMarketKey(t.label) === key || globalKey(t.label) === key)
    ?? (sameSeries ? ok.find((t) => sameSeries(t.market_key, key)) : undefined);
  return hit ? { ...hit, market_key: key } : current;
}

/** 검증 전 표준값은 CAGR이 저장 허용 범위 안일 때만 다시 적용한다(예전 규칙으로 저장된 과도한 값 제외). */
export function isUsableRef(ref: MarketRef): boolean {
  const cagr = Number(ref.cagr);
  if (!Number.isFinite(cagr) || !(Number(ref.base_value_eok) > 0)) return false;
  if (isTrustedRef(ref)) return true;
  return cagr > 0 && cagr <= MAX_STORED_CAGR;
}

interface Edit { start: number; end: number; text: string }
function applyEdits(text: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = text;
  let last = Infinity;
  for (const e of sorted) {
    if (e.end > last) continue; // 겹치는 수정은 버린다
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    last = e.start;
  }
  return out;
}

function applyRef(section: string, ref: MarketRef, kind: "domestic" | "global", targetYear: number): string {
  const r = { ...ref, base_value_eok: Number(ref.base_value_eok), cagr: Number(ref.cagr), base_year: Number(ref.base_year) };
  const fmt = kind === "domestic" ? formatKrwEok : formatUsdEok;
  const proj = kind === "domestic"
    ? (y: number) => projectEok(r.base_value_eok, r.cagr, r.base_year, y)
    : (y: number) => projectUsd(r.base_value_eok, r.cagr, r.base_year, y);
  const edits: Edit[] = [];
  for (const s of analyzeMarketScopes(section, kind, targetYear)) {
    if (s.label.key !== r.market_key) continue;
    for (const p of s.pairs) {
      if (p === s.base) {
        edits.push({ start: p.yearStart, end: p.yearStart + String(p.year).length, text: String(r.base_year) });
        edits.push({ start: p.figStart, end: p.figEnd, text: fmt(r.base_value_eok) });
      } else {
        edits.push({ start: p.figStart, end: p.figEnd, text: fmt(proj(p.year)) });
      }
    }
    for (const c of s.cagrs) {
      if (c.ambiguous) continue;
      edits.push({ start: c.numStart, end: c.numEnd, text: String(r.cagr) });
    }
  }
  return applyEdits(section, edits);
}

/** 해당 국내 시장의 범위(시장명~다음 시장명) 안에서 기준연도·기준값·CAGR·전망연도 값을 표준값으로 함께 다시 쓴다. */
export function applyMarketRef(section: string, ref: MarketRef, targetYear: number = currentSeoulYear()): string {
  return applyRef(section, ref, "domestic", targetYear);
}

/** 해당 글로벌 시장의 범위 안에서 기준연도·USD 규모·CAGR·전망연도 값을 표준값으로 함께 다시 쓴다. */
export function applyGlobalRef(section: string, ref: MarketRef, targetYear: number = currentSeoulYear()): string {
  return applyRef(section, ref, "global", targetYear);
}

/** anchor(기준 금액) 뒤 첫 문장 끝 앞에 출처 괄호를 넣는다. */
export function addSourceNote(section: string, anchor: string, note: string): string {
  const i = section.indexOf(anchor);
  if (i < 0) return section;
  const end = section.slice(i).search(/[.。](\s|$)/);
  if (end < 0) return section;
  const pos = i + end;
  return section.slice(0, pos) + ` ${note}` + section.slice(pos);
}

// ---------- 출처 표기 ----------
/** 괄호 안이 출처(기관명·보고서·발행연도) 또는 우리가 붙인 표기인지 */
function isCitationParen(inner: string): boolean {
  const t = inner.trim();
  if (t === AI_ESTIMATE_LABEL) return true;
  if (/출처|「|」|『|』/.test(t)) return true;
  if (/[A-Za-z가-힣][^,]*,\s*(?:19|20)\d{2}(?!\s*(?:년|[~∼～\-–]))/.test(t)) return true;
  if (/[A-Za-z가-힣]{2,}\s+(?:19|20)\d{2}$/.test(t)) return true;
  if (/;/.test(t) && /(?:19|20)\d{2}/.test(t)) return true;
  return false;
}

function stripCitations(s: string): string {
  return s.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => (isCitationParen(inner) ? "" : m));
}

interface FigureSpan { start: number; end: number }
function findFigures(text: string): FigureSpan[] {
  const out: FigureSpan[] = [];
  for (const m of text.matchAll(KRW_MONEY_RE)) out.push({ start: m.index!, end: m.index! + m[0].length });
  for (const m of text.matchAll(USD_MONEY_RE)) out.push({ start: m.index!, end: m.index! + m[0].length });
  for (const c of findCagrs(text)) out.push({ start: c.numStart, end: c.numEnd });
  return out;
}

/** 관련시장 동향 본문에 KRW/USD 시장규모와 CAGR이 모두 있는지 (추출기와 같은 금액 표기 규칙 사용) */
export function hasRequiredMarketFigures(content: string): boolean {
  const section = content.match(/##\s*관련시장\s*동향[\s\S]*?(?=\n##\s|$)/)?.[0] || "";
  KRW_MONEY_RE.lastIndex = 0;
  USD_MONEY_RE.lastIndex = 0;
  const hasMoney = KRW_MONEY_RE.test(section) || USD_MONEY_RE.test(section);
  KRW_MONEY_RE.lastIndex = 0;
  USD_MONEY_RE.lastIndex = 0;
  const hasCagr = findCagrs(section).length > 0 ||
    /(?:CAGR|연평균\s*성장률|연평균)[^\n.。]{0,40}\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%[^\n.。]{0,40}(?:CAGR|연평균|성장)/i.test(section);
  return hasMoney && hasCagr;
}

export interface ReconcileOptions {
  targetYear?: number;
  /** 운영자가 작성해 둔 고정 문단(대체 문단) — 이 안의 문장은 표기를 바꾸지 않는다. */
  exempt?: string[];
}

/**
 * 관련시장 동향 본문 보정의 전체 과정(순수 함수).
 * 1) 시장별 표준값을 범위 단위로 적용(표준값이 없으면 본문 자체 수치로 기준값-전망값을 맞춤)
 * 2) 공식/승인 표준값 범위의 수치 문장은 그 출처로, 나머지 수치 문장은 "(AI 추정치)"로 표기
 */
export function reconcileMarketSection(section: string, refs: MarketRef[], opts: ReconcileOptions = {}): string {
  const targetYear = opts.targetYear ?? currentSeoulYear();
  const usable = refs.filter(isUsableRef);
  const byKey = new Map(usable.map((r) => [r.market_key, r]));
  let text = section;
  for (const kind of ["domestic", "global"] as const) {
    const claims = extractClaims(text, kind, targetYear);
    for (const claim of claims) {
      // 표준값이 없으면(저장 실패·CAGR 범위 밖 등) 본문 자체의 기준값·CAGR로 전망값만 일관되게 맞춘다.
      const ref = byKey.get(claim.key) ?? claimToRef(claim);
      if (ref) text = applyRef(text, ref, kind, targetYear);
    }
  }
  return annotateMarketSources(text, usable.filter(isTrustedRef), opts.exempt ?? [], targetYear);
}

function annotateMarketSources(text: string, trusted: MarketRef[], exempt: string[], targetYear: number): string {
  const trustedScopes: Array<{ start: number; end: number; ref: MarketRef }> = [];
  for (const kind of ["domestic", "global"] as const) {
    for (const s of analyzeMarketScopes(text, kind, targetYear)) {
      const ref = trusted.find((r) => r.market_key === s.label.key);
      if (ref) trustedScopes.push({ start: s.start, end: s.end, ref });
    }
  }
  const figures = findFigures(text);
  const spans: Array<[number, number]> = [];
  let s = 0;
  for (const m of text.matchAll(/[.。](?=\s|$)/g)) { spans.push([s, m.index!]); s = m.index! + 1; }
  if (text.slice(s).trim()) spans.push([s, text.length]);
  const edits: Edit[] = [];
  for (const [a, b] of spans) {
    const figs = figures.filter((f) => f.start >= a && f.end <= b);
    if (!figs.length) continue;
    const body = text.slice(a, b);
    const plain = body.trim();
    if (exempt.some((e) => e.includes(plain))) continue;
    const refsHere: MarketRef[] = [];
    let untrusted = 0;
    for (const f of figs) {
      const sc = trustedScopes.find((t) => f.start >= t.start && f.end <= t.end);
      if (!sc) untrusted++;
      else if (!refsHere.includes(sc.ref)) refsHere.push(sc.ref);
    }
    const notes = refsHere.map((r) => {
      // 괄호 안에 괄호가 생기면 재보정 때 출처를 지울 수 없으므로 출처의 괄호는 공백으로 바꾼다.
      const src = String(r.source).replace(/[()（）]/g, " ").replace(/\s+/g, " ").trim();
      const hasBase = body.includes(String(r.base_year)) &&
        body.includes(String(r.market_key).startsWith("글로벌") ? formatUsdEok(Number(r.base_value_eok)) : formatKrwEok(Number(r.base_value_eok)));
      return hasBase ? `출처: ${src}, ${r.base_year}년 기준` : `출처: ${src}, ${r.base_year}년 기준값에서 환산`;
    });
    if (untrusted) notes.push(AI_ESTIMATE_LABEL);
    const stripped = stripCitations(body).replace(/\s+$/, "");
    edits.push({ start: a, end: b, text: `${stripped}(${notes.join("; ")})` });
  }
  return applyEdits(text, edits);
}
