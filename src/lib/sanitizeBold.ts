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
  // 엄격: [숫자 + 단위 명사]만 캡처. 주변 동사/연결어를 절대 포함하지 않음.
  // 서열번호 1 (내지 6)
  /서열번호\s*\d+(?:\s*내지\s*\d+)?/g,
  // 금액: 약? + 숫자 + (조|억|만|천)? + 원/달러/위안/엔
  /약\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:조|억|만|천)?\s?(?:원|달러|위안|엔)/g,
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:조|억|만|천)?\s?(?:원|달러|위안|엔)/g,
  // 연도 (4자리)
  /(?:19|20)\d{2}년/g,
  // 수량 + 단위 (단위 직후 경계: 공백/구두점/끝)
  /\d+(?:\.\d+)?\s?(?:개월|개체|마리|단계|회|kg|mg|ml|μm|nm|cm|mm|°C)(?=[\s.,;:)\]"'」』]|$)/g,
  // % / 배 / 퍼센트
  /\d+(?:\.\d+)?\s?(?:%|퍼센트|배)(?=[\s.,;:)\]"'」』]|$)/g,
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

// 한국어 조사/어미 — 매칭 결과 끝에서 탈락시킬 접미사 목록 (긴 것부터)
const TRAILING_PARTICLES = [
  "덕분에", "에서", "으로", "이며", "하며", "하는", "되는", "이다",
  "이고", "이라", "이란", "이나", "라는", "라고",
  "을", "를", "이", "가", "은", "는", "에", "의", "로", "고", "며",
  "된", "한", "적", "와", "과", "도", "만", "랑", "야", "여", "서",
];

// 매칭 결과가 일반 명사구로 적합한지 검증 (동사/형용사 어미·조사 포함 시 거부)
const SENTENCEY_RE = /(?:다는|라는|어려운|어렵다|쉽다|않다|있다|없다|된다|한다|하다|되다|위해|위한|통해|통한|확보가|확보를|가능한|불가능|때문에)/;

function trimTrailingParticles(s: string): string {
  let out = s;
  // 반복 적용 (예: "메커니즘을" → "메커니즘")
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const p of TRAILING_PARTICLES) {
      if (out.length > p.length + 1 && out.endsWith(p)) {
        out = out.slice(0, -p.length);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return out.trimEnd();
}

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
    let key = raw.trim();
    if (!key || key.length < 2) return false;
    // 조사/어미 끝부분 탈락 → 길이 차이만큼 end 축소
    const trimmed = trimTrailingParticles(key);
    if (!trimmed || trimmed.length < 2) return false;
    // 문장형(동사·서술어 포함) 거부
    if (SENTENCEY_RE.test(trimmed)) return false;
    // 공백을 끝에서 제거한 만큼 end 보정
    const dropped = key.length - trimmed.length;
    const adjustedEnd = end - dropped;
    key = trimmed;
    if (paragraphSeen.has(key)) return false;
    if (/^[\s.,;:()[\]{}'"`~!@#$%^&*]+$/.test(key)) return false;
    occupied.push([start, adjustedEnd]);
    inserts.push({ start, end: adjustedEnd, text: `**${key}**` });
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
    // 사전은 순수 명사구만 허용 — 동사·조사 포함 항목은 제외
    const cleanDict = DOMAIN_PHRASES.filter((p) => !SENTENCEY_RE.test(p));
    const sorted = [...cleanDict].sort((a, b) => b.length - a.length);
    for (const phrase of sorted) {
      if (sentenceBudget <= 0 || paragraphBudget.remaining <= 0) break;
      const idx = sentence.indexOf(phrase);
      if (idx === -1) continue;
      // 매칭 직후가 한국어 조사로 이어지더라도 phrase 자체만 강조 (조사는 자연히 바깥)
      tryAdd(idx, idx + phrase.length, phrase);
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