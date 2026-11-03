// 요약서를 '한 편의 보고서'처럼 보여 주기 위한 순수 함수들 (화면·인쇄 공통).
// - 긴 문단을 문장 단위로 나눠 요지(첫 문장)와 3문장 단위 문단으로 묶는다.
// - 관련시장 동향 문장에서 시장별 기준 규모·연평균 성장률·전망·근거(공식 통계/AI 추정)를 뽑아 요약표로 만든다.
// - 본문의 "(출처: …)", "(AI 추정치)" 괄호를 근거 배지로 바꿀 수 있게 나눈다.
// 숫자와 문장은 바꾸지 않는다. 서버(summarize-patent/marketConsistency)가 붙인 표기를 그대로 읽기만 한다.

/** 문장 끝(. ! ? 。 뒤 공백)에서 나눈다. 6.3%·444.9억 같은 소수점과 괄호 안은 나누지 않는다. */
export function splitSentences(text: string): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "(" || c === "（") depth++;
    else if ((c === ")" || c === "）") && depth > 0) depth--;
    else if (depth === 0 && /[.!?。]/.test(c) && (i + 1 >= t.length || /\s/.test(t[i + 1]))) {
      // 끝에 붙은 각주 표시([^1])까지 같은 문장으로
      let end = i + 1;
      const fn = t.slice(end).match(/^(?:\[\^\d+\])+/);
      if (fn) end += fn[0].length;
      const s = t.slice(start, end).trim();
      if (s) out.push(s);
      start = end;
      i = end - 1;
    }
  }
  const rest = t.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** 문단 여러 개를 '요지(첫 문장)'와 3문장 단위 문단으로 다시 묶는다. 문장이 적으면 그대로 둔다. */
export function toReportParagraphs(paragraphs: string[], size = 3): { lead: string; body: string[] } {
  const sentences = paragraphs.flatMap(splitSentences);
  if (sentences.length <= 1) return { lead: sentences[0] ?? "", body: [] };
  const [lead, ...rest] = sentences;
  const body: string[] = [];
  for (let i = 0; i < rest.length; i += size) body.push(rest.slice(i, i + size).join(" "));
  return { lead, body };
}

export type MarketTrust = "official" | "ai" | "unknown";
export interface MarketRow {
  label: string;
  baseYear?: number;
  baseAmount?: string;
  cagr?: string;
  projYear?: number;
  projAmount?: string;
  trust: MarketTrust;
  source?: string;
}

const AMOUNT = String.raw`(?:USD\s*[\d,.]+\s*(?:억|십억|billion|million)?|[\d,.]+\s*(?:조(?:\s*[\d,]+\s*억)?|억)\s*(?:[\d,]+\s*만\s*)?원)`;
const YEAR_AMOUNT = new RegExp(String.raw`((?:19|20)\d{2})\s*년(?:에|의|\s*기준)?\s*(?:약\s*)?(?:시장\s*규모[는은가이]?\s*)?(${AMOUNT})`, "g");
const AMOUNT_ONLY = new RegExp(AMOUNT, "g");
const CAGR = /(?:연평균|CAGR)[^\d%]{0,12}(\d+(?:\.\d+)?)\s*%/;
const SOURCE = /\(\s*출처:\s*([^()]*?)\s*(?:,\s*(?:19|20)\d{2}년\s*기준(?:값에서\s*환산)?)?\s*\)/;
const AI_EST = /\(\s*AI\s*추정치\s*\)/;

function marketLabel(sentence: string): string | null {
  // 굵게 표시한 시장명 → 없으면 '…시장' 명사구
  const bold = [...sentence.matchAll(/\*\*([^*]{2,40}?시장)\*\*/g)].map((m) => m[1].trim());
  if (bold.length) return bold[0];
  const plain = sentence.match(/((?:국내|글로벌|세계|전\s*세계|국외|해외|아시아|미국|중국|일본|유럽)\s*[가-힣A-Za-z·\s]{1,24}?시장)(?=\s*(?:규모|은|는|이|가|의|도|에서|에|으로|로|,))/);
  return plain ? plain[1].replace(/\s+/g, " ").trim() : null;
}

/** 관련시장 동향 문단에서 시장별 요약 행을 뽑는다. 기준 규모나 성장률 중 하나도 없는 시장은 뺀다. */
export function parseMarketRows(paragraphs: string[]): MarketRow[] {
  const rows: MarketRow[] = [];
  let current: MarketRow | null = null;
  for (const raw of paragraphs.flatMap(splitSentences)) {
    const s = raw.replace(/\[\^\d+\]/g, "");
    const label = marketLabel(s);
    if (label) {
      const key = label.replace(/\s+/g, "");
      current = rows.find((r) => r.label.replace(/\s+/g, "") === key) ?? null;
      if (!current) { current = { label, trust: "unknown" }; rows.push(current); }
    }
    if (!current) continue;
    const plain = s.replace(/\*\*/g, "");
    const pairs = [...plain.matchAll(YEAR_AMOUNT)].map((m) => ({ year: Number(m[1]), amount: m[2].replace(/\s+/g, " ").trim() }));
    // "2026년 약 1조 3,984억 원을 형성"처럼 연도와 금액 사이에 낱말이 끼면 금액만 따로 찾는다
    if (!pairs.length) {
      const years = [...plain.matchAll(/((?:19|20)\d{2})\s*년/g)].map((m) => Number(m[1]));
      const amounts = [...plain.matchAll(AMOUNT_ONLY)].map((m) => m[0].replace(/\s+/g, " ").trim());
      years.forEach((y, i) => { if (amounts[i]) pairs.push({ year: y, amount: amounts[i] }); });
    }
    for (const p of pairs) {
      if (current.baseYear == null || p.year < current.baseYear) {
        if (current.baseYear != null && (current.projYear == null || current.baseYear > current.projYear)) { current.projYear = current.baseYear; current.projAmount = current.baseAmount; }
        current.baseYear = p.year; current.baseAmount = p.amount;
      } else if (p.year > current.baseYear && (current.projYear == null || p.year >= current.projYear)) {
        current.projYear = p.year; current.projAmount = p.amount;
      }
    }
    const c = plain.match(CAGR);
    if (c && !current.cagr) current.cagr = `${c[1]}%`;
    const src = plain.match(SOURCE);
    if (src) { current.trust = "official"; current.source = current.source ?? src[1].trim(); }
    else if (AI_EST.test(plain) && current.trust === "unknown") current.trust = "ai";
  }
  return rows.filter((r) => r.baseAmount || r.cagr);
}

export type TrustPart = { text: string } | { trust: "official"; source: string; converted: boolean } | { trust: "ai" };

/** 문단을 본문 조각과 근거 괄호("(출처: …)", "(AI 추정치)")로 나눈다. */
export function splitTrustNotes(text: string): TrustPart[] {
  const out: TrustPart[] = [];
  const re = /\(\s*(출처:[^()]*|AI\s*추정치)\s*\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    const inner = m[1].trim();
    if (/^AI/.test(inner)) out.push({ trust: "ai" });
    else {
      // "출처: A, 2024년 기준; AI 추정치" 처럼 섞인 괄호도 있다
      const parts = inner.split(/;\s*/);
      const off = parts.find((p) => /^출처:/.test(p));
      if (off) out.push({ trust: "official", source: off.replace(/^출처:\s*/, "").replace(/,\s*(?:19|20)\d{2}년\s*기준(?:값에서\s*환산)?\s*$/, "").trim(), converted: /환산/.test(off) });
      if (parts.some((p) => /AI\s*추정치/.test(p))) out.push({ trust: "ai" });
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
