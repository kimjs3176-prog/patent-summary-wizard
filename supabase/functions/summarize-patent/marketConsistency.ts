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
const CAGR_RE = /(연평균(?:\s*성장률)?|CAGR)([^.。%\d]{0,20}?)(\d+(?:\.\d+)?)\s*%/i;
const TARGET_RE = new RegExp(String.raw`(${TARGET_YEAR}\s*년[^.。\d]{0,30}?(?:약\s*)?)(${AMOUNT})(\s*원)`, "g");

export interface MarketClaim { label: string; key: string; baseYear: number; baseEok: number; cagr: number | null }

export function extractMarketClaim(section: string): MarketClaim | null {
  const m = CLAIM_RE.exec(section);
  if (!m) return null;
  const baseYear = Number(m[2]);
  const baseEok = parseKrwEok(m[4]);
  if (!baseEok || baseYear >= TARGET_YEAR) return null;
  const after = section.slice(m.index);
  const c = CAGR_RE.exec(after);
  const label = m[1].replace(/\s+/g, " ").trim();
  return { label, key: normalizeMarketKey(label), baseYear, baseEok, cagr: c ? parseFloat(c[3]) : null };
}

/** 섹션 텍스트에 표준값을 적용해 기준값·CAGR·2026년 값을 통일한다. */
export function applyMarketRef(section: string, ref: MarketRef): string {
  const m = CLAIM_RE.exec(section);
  if (!m) return section;
  const start = m.index;
  let claim = m[0];
  claim = claim.replace(new RegExp(`${m[2]}(\\s*년)`), `${ref.base_year}$1`);
  claim = claim.replace(new RegExp(`${m[4].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s*원)$`), `${formatKrwEok(ref.base_value_eok)}$1`);
  let out = section.slice(0, start) + claim + section.slice(start + m[0].length);
  // CAGR: 기준값 이후 첫 연평균 표기
  const afterIdx = start + claim.length;
  // 글로벌 시장 문장의 CAGR은 건드리지 않도록 '글로벌/세계' 언급 전까지만 교체
  const rest = out.slice(afterIdx);
  const gi = rest.search(/글로벌|세계/);
  const head = gi < 0 ? rest : rest.slice(0, gi);
  out = out.slice(0, afterIdx) + head.replace(CAGR_RE, (_s, a, b) => `${a}${b}${ref.cagr}%`) + rest.slice(head.length);
  // 국내 원화 기준 2026년 값은 복리 공식으로 재계산 (USD 문장은 원화 패턴이 아니므로 영향 없음)
  const projected = formatKrwEok(projectEok(ref.base_value_eok, ref.cagr, ref.base_year));
  out = out.replace(TARGET_RE, (_s, pre, _amt, won) => `${pre}${projected}${won}`);
  return out;
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

export function claimToRef(c: MarketClaim): MarketRef | null {
  if (c.cagr == null || c.cagr <= 0 || c.cagr > 60) return null;
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

export function extractGlobalClaim(section: string): MarketClaim | null {
  const m = GLOBAL_RE.exec(section);
  if (!m) return null;
  const baseEok = parseUsdEok(m[4]);
  if (!baseEok) return null;
  const sentenceEnd = section.slice(m.index).search(/[.。](\s|$)/);
  const sentence = section.slice(m.index, sentenceEnd < 0 ? undefined : m.index + sentenceEnd);
  const c = CAGR_RE.exec(sentence);
  const label = m[1].replace(/\s+/g, " ").trim();
  return { label, key: globalKey(label), baseYear: Number(m[2]), baseEok, cagr: c ? parseFloat(c[3]) : null };
}

/** 글로벌 시장 문장의 기준연도·USD 규모·같은 문장 안 CAGR을 표준값으로 바꾼다. */
export function applyGlobalRef(section: string, ref: MarketRef): string {
  const m = GLOBAL_RE.exec(section);
  if (!m) return section;
  const start = m.index;
  let claim = m[0];
  claim = claim.replace(new RegExp(`${m[2]}(\\s*년)`), `${ref.base_year}$1`);
  claim = claim.slice(0, claim.length - m[4].length) + formatUsdEok(Number(ref.base_value_eok));
  let out = section.slice(0, start) + claim + section.slice(start + m[0].length);
  const afterIdx = start + claim.length;
  const rest = out.slice(afterIdx);
  const endRel = rest.search(/[.。](\s|$)/);
  const sentence = endRel < 0 ? rest : rest.slice(0, endRel);
  const fixedSentence = sentence.replace(CAGR_RE, (_s, a, b) => `${a}${b}${ref.cagr}%`);
  out = out.slice(0, afterIdx) + fixedSentence + rest.slice(sentence.length);
  return out;
}
