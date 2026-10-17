// 관련시장 동향의 국내(원화) 시장규모를 같은 시장이면 항상 같은 값으로 고정하는 결정론적 보정기.
// 1) 처음 확정된 (시장명·기준연도·기준값·CAGR·출처)를 표준값으로 저장
// 2) 이후 같은 시장이 나오면 표준값으로 덮어쓰고 2026년 값은 복리 공식으로 재계산

export interface MarketRef {
  market_key: string;
  label: string;
  base_year: number;
  base_value_eok: number; // 억 원
  cagr: number;           // %
  source?: string | null;
}

export const TARGET_YEAR = 2026;

const AMOUNT = String.raw`(?:\d+(?:\.\d+)?\s*조(?:\s*[\d,]+\s*억)?|[\d,]+(?:\.\d+)?\s*억)`;

export function parseKrwEok(s: string): number | null {
  const t = s.replace(/\s+/g, "");
  const m = t.match(/^(?:(\d+(?:\.\d+)?)조)?(?:([\d,]+(?:\.\d+)?)억)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const jo = m[1] ? parseFloat(m[1]) : 0;
  const eok = m[2] ? parseFloat(m[2].replace(/,/g, "")) : 0;
  return Math.round(jo * 10000 + eok);
}

export function formatKrwEok(eok: number): string {
  const v = Math.round(eok);
  const jo = Math.floor(v / 10000);
  const rest = v % 10000;
  if (jo === 0) return `${rest.toLocaleString("en-US")}억`;
  if (rest === 0) return `${jo}조`;
  return `${jo}조 ${rest.toLocaleString("en-US")}억`;
}

export function projectEok(base: number, cagr: number, fromYear: number, toYear = TARGET_YEAR): number {
  return Math.round(base * Math.pow(1 + cagr / 100, toYear - fromYear));
}

export function normalizeMarketKey(name: string): string {
  return name.replace(/\s+/g, "").replace(/(규모|전체)/g, "").replace(/^대한민국|^한국/, "국내");
}

const CLAIM_RE = new RegExp(
  String.raw`((?:국내|한국)\s*[가-힣A-Za-z·\s]{1,24}?시장)(?:\s*규모)?[^.。]{0,40}?((?:19|20)\d{2})\s*년[^.。\d]{0,20}?(약\s*)?(${AMOUNT})\s*원`,
);
const CLAIM_RE_G = new RegExp(CLAIM_RE.source, "g");
const CAGR_RE = /(연평균(?:\s*성장률)?|CAGR)([^.。%\d]{0,20}?)(\d+(?:\.\d+)?)\s*%/i;
const TARGET_RE = new RegExp(String.raw`(${TARGET_YEAR}\s*년[^.。\d]{0,30}?(?:약\s*)?)(${AMOUNT})(\s*원)`, "g");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** match 이후 문장 끝(마침표)까지의 범위 끝 인덱스 */
function sentenceEnd(text: string, from: number): number {
  const rel = text.slice(from).search(/[.。](\s|$)/);
  return rel < 0 ? text.length : from + rel;
}

export interface MarketClaim { label: string; key: string; baseYear: number; baseEok: number; cagr: number | null }

export function extractMarketClaim(section: string): MarketClaim | null {
  return extractMarketClaims(section)[0] ?? null;
}

/** 섹션에 등장하는 모든 국내 시장 주장을 시장별로 추출한다. */
export function extractMarketClaims(section: string): MarketClaim[] {
  const out: MarketClaim[] = [];
  const seen = new Set<string>();
  for (const m of section.matchAll(CLAIM_RE_G)) {
    const baseYear = Number(m[2]);
    const baseEok = parseKrwEok(m[4]);
    if (!baseEok || baseYear >= TARGET_YEAR) continue;
    const label = m[1].replace(/\s+/g, " ").trim();
    const key = normalizeMarketKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    const sent = section.slice(m.index!, sentenceEnd(section, m.index!));
    const c = CAGR_RE.exec(sent);
    out.push({ label, key, baseYear, baseEok, cagr: c ? parseFloat(c[3]) : null });
  }
  return out;
}

/** 해당 시장의 문장 범위 안에서만 기준값·CAGR·2026년 값을 표준값으로 통일한다. 다른 시장의 수치는 건드리지 않는다. */
export function applyMarketRef(section: string, ref: MarketRef): string {
  const matches = [...section.matchAll(CLAIM_RE_G)];
  const m = matches.find((x) => normalizeMarketKey(x[1]) === ref.market_key) ?? null;
  if (!m || m.index == null) return section;
  const start = m.index;
  const end = sentenceEnd(section, start);
  let sent = section.slice(start, end);
  sent = sent.replace(new RegExp(`${m[2]}(\\s*년)`), `${ref.base_year}$1`);
  sent = sent.replace(new RegExp(`${escapeRe(m[4])}(\\s*원)`), `${formatKrwEok(ref.base_value_eok)}$1`);
  sent = sent.replace(CAGR_RE, (_s, a, b) => `${a}${b}${ref.cagr}%`);
  const projected = formatKrwEok(projectEok(ref.base_value_eok, ref.cagr, ref.base_year));
  sent = sent.replace(TARGET_RE, (_s, pre, _amt, won) => `${pre}${projected}${won}`);
  return section.slice(0, start) + sent + section.slice(end);
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

/** "국내 시장", "국내 상위 시장", "관련 시장"처럼 무엇인지 불분명한 시장명 */
export function isAmbiguousMarket(key: string): boolean {
  const core = key.replace(/^(국내|글로벌|세계|전세계|한국)/, "").replace(/시장$/, "");
  return core.length < 2 || /상위|관련|해당|전방|목표|대상|유관|기타/.test(core);
}

export function claimToRef(c: MarketClaim): MarketRef | null {
  if (c.cagr == null || c.cagr <= 0 || c.cagr > 60) return null;
  if (isAmbiguousMarket(c.key)) return null;
  return { market_key: c.key, label: c.label, base_year: c.baseYear, base_value_eok: c.baseEok, cagr: c.cagr };
}

// ---- 글로벌(USD) 시장: 같은 시장이면 같은 기준연도·규모·CAGR로 통일 ----
// market_reference에 market_key "글로벌…"로 저장하며, base_value_eok 칸에는 'USD 억' 단위 값을 넣는다.
const USD_AMOUNT = String.raw`(?:USD\s*[\d,]+(?:\.\d+)?\s*(?:억|십억|billion|million)?|[\d,]+(?:\.\d+)?\s*(?:억|십억)\s*달러)`;
const GLOBAL_RE = new RegExp(
  String.raw`((?:글로벌|세계|전\s*세계)\s*[가-힣A-Za-z·\s]{1,24}?시장)(?:\s*규모)?[^.。]{0,40}?((?:19|20)\d{2})\s*년[^.。\d]{0,20}?(약\s*)?(${USD_AMOUNT})`,
  "i",
);

export function parseUsdEok(s: string): number | null {
  const t = s.replace(/\s+/g, "").replace(/^USD/i, "").replace(/달러$/, "");
  const m = t.match(/^([\d,]+(?:\.\d+)?)(억|십억|billion|million)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  const u = (m[2] || "억").toLowerCase();
  const v = u === "십억" || u === "billion" ? n * 10 : u === "million" ? n / 100 : n;
  return Math.round(v * 10) / 10;
}

export function formatUsdEok(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `USD ${r.toLocaleString("en-US", { maximumFractionDigits: 1 })}억`;
}

export function globalKey(label: string): string {
  return label.replace(/\s+/g, "").replace(/(규모|전체)/g, "").replace(/^(세계|전세계)/, "글로벌");
}

const GLOBAL_RE_G = new RegExp(GLOBAL_RE.source, "gi");

export function extractGlobalClaim(section: string): MarketClaim | null {
  return extractGlobalClaims(section)[0] ?? null;
}

/** 섹션에 등장하는 모든 글로벌 시장 주장을 시장별로 추출한다. */
export function extractGlobalClaims(section: string): MarketClaim[] {
  const out: MarketClaim[] = [];
  const seen = new Set<string>();
  for (const m of section.matchAll(GLOBAL_RE_G)) {
    const baseEok = parseUsdEok(m[4]);
    if (!baseEok) continue;
    const label = m[1].replace(/\s+/g, " ").trim();
    const key = globalKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    const sent = section.slice(m.index!, sentenceEnd(section, m.index!));
    const c = CAGR_RE.exec(sent);
    out.push({ label, key, baseYear: Number(m[2]), baseEok, cagr: c ? parseFloat(c[3]) : null });
  }
  return out;
}

/** 해당 글로벌 시장의 문장 범위 안에서만 기준연도·USD 규모·CAGR을 표준값으로 바꾼다. */
export function applyGlobalRef(section: string, ref: MarketRef): string {
  const matches = [...section.matchAll(GLOBAL_RE_G)];
  const m = matches.find((x) => globalKey(x[1]) === ref.market_key) ?? null;
  if (!m || m.index == null) return section;
  const start = m.index;
  const end = sentenceEnd(section, start);
  let sent = section.slice(start, end);
  sent = sent.replace(new RegExp(`${m[2]}(\\s*년)`), `${ref.base_year}$1`);
  sent = sent.replace(new RegExp(escapeRe(m[4])), formatUsdEok(Number(ref.base_value_eok)));
  sent = sent.replace(CAGR_RE, (_s, a, b) => `${a}${b}${ref.cagr}%`);
  return section.slice(0, start) + sent + section.slice(end);
}
