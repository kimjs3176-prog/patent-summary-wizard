// =============================================================================
import { correctTypos } from "./typoCorrections";

// Auto-highlight engine
// -----------------------------------------------------------------------------
// The AI model is instructed to NOT emit any **bold** markers. This module
// strips any leftover bolds and then applies deterministic, pattern-based
// highlighting to high-signal spans only.
//
// Strategy:
//   (A) Quantitative data — numbers + unit, year, percent, multiplier, seq#
//   (B) Proper nouns / scientific terms — English noun phrases, ALL-CAPS
//       abbreviations, strain IDs
//   (C) Domain noun-phrases — curated dictionary (e.g. "정밀 사양 관리",
//       "맞춤형 비육 전략", "고급육 출현율")
//   (D) Decisive comparators — "세계 최초", "핵심 과제" 등 (in dictionary)
//
// Constraints:
//   - Skip italic spans (*..*) — scientific names are already styled.
//   - Skip headers / lists / footnote rows / code fences / tables.
//   - Per-sentence cap: 2 bolds. Per-paragraph cap: 4. Each unique span
//     is bolded at most once per paragraph.
// =============================================================================

// ----- (A) Quantitative patterns ---------------------------------------------
const QUANT_PATTERNS: RegExp[] = [
  // "기존 대비 2.5배" / "약 15% 이상 향상"
  /기존\s*대비\s*\d+(?:\.\d+)?\s*(?:배|%|퍼센트)(?:\s*(?:이상|이하|향상|증가|감소))?/g,
  /약\s*\d+(?:\.\d+)?\s*%\s*(?:이상|이하)?\s*(?:향상|증가|감소|개선|절감)/g,
  // 서열번호 1 (내지 6)
  /서열번호\s*\d+(?:\s*내지\s*\d+)?/g,
  // 금액 단위
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:조|억|만)\s*(?:원|달러|위안|엔)/g,
  // 연도
  /(?:19|20)\d{2}\s*년/g,
  // 기간·수량 + 단위
  /\d+(?:\.\d+)?\s*(?:개월|개체|마리|단계|회|kg|mg|ml|μm|nm|cm|mm|°C)\b/g,
  /\d+\s*년(?!대)/g,
  // % / 배
  /\d+(?:\.\d+)?\s*(?:%|퍼센트|배|배가량)/g,
];

// ----- (B) Proper-noun / scientific term patterns ----------------------------
const PROPER_PATTERNS: RegExp[] = [
  // 학술적 영문 구: "Fibronectin 1", "Matrix metallopeptidase 7"
  /\b[A-Z][a-z]{2,}(?:\s+[a-z]+){0,3}(?:\s+\d+)?\b/g,
  // ALL-CAPS 약어 (2~6자) — 단독 의미 명확
  /\b[A-Z]{2,6}(?:-\d+)?\b/g,
  // 균주 ID
  /\b(?:KCTC|KACC|KCCM|ATCC|NRRL)\s*\d+\b/g,
];

// ----- (C) Domain noun-phrase dictionary -------------------------------------
const DOMAIN_PHRASES: string[] = [
  // 정밀 농축산
  "개체별 맞춤형 비육 전략", "맞춤형 비육 전략", "정밀 사양 관리",
  "스마트 축산", "고급육 출현율", "마블링 점수", "근육 내 지방 축적",
  "근내지방도", "유전체 분석", "고부가가치 바이오 진단", "현장 진단 키트",
  "비육 기간 단축", "사료비 절감", "수익 구조 안정화", "출하 시기 최적화",
  // 효능·기능
  "항균 활성", "항산화 활성", "항염 활성", "항암 활성", "생체이용률",
  "내구성", "내열성", "내수성", "내약품성", "저독성", "고수율",
  "정확도", "민감도", "특이도", "재현성", "안정성", "신뢰성",
  "상관관계", "통계적 유의성", "유효 성분", "활성 성분",
  // 산업·시장
  "친환경 농약", "사료 첨가제", "기능성 식품", "기능성 소재",
  "장염 치료제", "백신 후보", "프리미엄 시장", "B2B 공급",
  "라이선싱 모델", "기술이전", "OEM 공급",
  // 결정·평가
  "세계 최초", "국내 최초", "업계 최초", "핵심 과제", "차별적 강점",
  "시장 안착의 핵심", "결정적 차별점",
];

const SKIP_LINE_RE = /^(\s*#|\s*\||\s*```|\s*-\s|\s*\d+\.\s|\s*\[\^|\s*>\s|\s*###)/;

function stripExistingBold(text: string): string {
  // Remove ** markers but keep inner text.
  return text.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
}

// Bullet-like single `*` at line start (or after sentence end inside a paragraph)
// were being misread as italic openers and italicizing entire paragraphs.
// Convert them to plain text so only true `*word*` italic spans (with no
// surrounding whitespace) survive.
function stripBulletStars(text: string): string {
  // 1) Line-start bullets: `* 핵심 유전자:` → `핵심 유전자:`
  let out = text.replace(/^[ \t]*\*[ \t]+/gm, "");
  // 2) Mid-line pseudo-bullets after sentence break: `... 합니다. * 표적 식물:` → `... 합니다. 표적 식물:`
  out = out.replace(/([.!?。．！？])\s+\*\s+/g, "$1 ");
  // 3) Defensive: `*` with whitespace on at least one side that is not part of
  // a `*word*` italic pair gets removed.
  out = out.replace(/(^|\s)\*(\s)/g, "$1$2");
  out = out.replace(/(\s)\*(\s|$)/g, "$1$2");
  return out;
}

function maskItalics(text: string): { masked: string; spans: string[] } {
  const spans: string[] = [];
  // Italic only when `*` is tight around the content (no leading/trailing whitespace)
  // — this prevents accidental italicization across bullet markers or sentences.
  const masked = text.replace(/\*([^\s*\n][^*\n]*?[^\s*\n]|[^\s*\n])\*/g, (m) => {
    spans.push(m);
    return `\u0001${spans.length - 1}\u0002`;
  });
  return { masked, spans };
}

function unmaskItalics(text: string, spans: string[]): string {
  return text.replace(/\u0001(\d+)\u0002/g, (_, i) => spans[Number(i)] ?? "");
}

function splitSentences(paragraph: string): string[] {
  const parts = paragraph.split(/(?<=[.!?。．！？])\s+/);
  return parts.length ? parts : [paragraph];
}

function highlightSentence(
  sentence: string,
  paragraphSeen: Set<string>,
  paragraphBudget: { remaining: number },
): string {
  if (sentence.length < 8) return sentence;

  const occupied: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) =>
    occupied.some(([a, b]) => s < b && e > a);

  const inserts: Array<{ start: number; end: number; text: string }> = [];
  let sentenceBudget = 2;

  const tryAdd = (start: number, end: number, raw: string) => {
    if (sentenceBudget <= 0 || paragraphBudget.remaining <= 0) return false;
    if (overlaps(start, end)) return false;
    const key = raw.trim();
    if (!key || key.length < 2) return false;
    if (paragraphSeen.has(key)) return false;
    if (/^[\s.,;:()[\]{}'"`~!@#$%^&*]+$/.test(key)) return false;
    occupied.push([start, end]);
    inserts.push({ start, end, text: `**${raw}**` });
    paragraphSeen.add(key);
    sentenceBudget--;
    paragraphBudget.remaining--;
    return true;
  };

  const scan = (patterns: RegExp[]) => {
    for (const p of patterns) {
      p.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.exec(sentence)) !== null) {
        if (sentenceBudget <= 0 || paragraphBudget.remaining <= 0) return;
        tryAdd(m.index, m.index + m[0].length, m[0]);
      }
    }
  };

  // (A) numbers first — highest precedence
  scan(QUANT_PATTERNS);

  // (C) curated noun-phrases (longest first)
  if (sentenceBudget > 0 && paragraphBudget.remaining > 0) {
    const sorted = [...DOMAIN_PHRASES].sort((a, b) => b.length - a.length);
    for (const phrase of sorted) {
      if (sentenceBudget <= 0 || paragraphBudget.remaining <= 0) break;
      const idx = sentence.indexOf(phrase);
      if (idx !== -1) tryAdd(idx, idx + phrase.length, phrase);
    }
  }

  // (B) proper nouns / scientific abbreviations
  if (sentenceBudget > 0 && paragraphBudget.remaining > 0) {
    scan(PROPER_PATTERNS);
  }

  if (inserts.length === 0) return sentence;

  inserts.sort((a, b) => b.start - a.start);
  let out = sentence;
  for (const ins of inserts) {
    out = out.slice(0, ins.start) + ins.text + out.slice(ins.end);
  }
  return out;
}

function highlightParagraph(paragraph: string): string {
  if (SKIP_LINE_RE.test(paragraph)) return paragraph;
  const seen = new Set<string>();
  const budget = { remaining: 4 };
  const sentences = splitSentences(paragraph);
  return sentences.map((s) => highlightSentence(s, seen, budget)).join(" ");
}

/**
 * Public API — keeps the name `sanitizeBoldMarkers` for backward compatibility.
 * 1) Strip any model-emitted **bold** 2) Mask italics 3) Auto-highlight 4) Restore italics.
 */
export function sanitizeBoldMarkers(text: string): string {
  if (!text) return text;
  // 0) 규칙 기반 오타/맞춤법 사전 치환 (전체 요약서 텍스트에 일괄 적용)
  const corrected = correctTypos(text);
  const stripped = stripExistingBold(corrected);
  const debulleted = stripBulletStars(stripped);
  const { masked, spans } = maskItalics(debulleted);
  const paragraphs = masked.split(/(\n{2,})/);
  const processed = paragraphs
    .map((chunk) => (/^\n{2,}$/.test(chunk) ? chunk : highlightParagraph(chunk)))
    .join("");
  return unmaskItalics(processed, spans);
}