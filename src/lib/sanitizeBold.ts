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
  // 엄격: [숫자 + 단위/이상/이하]만 캡처. 주변 동사/서술어는 포함하지 않는다.
  /기존\s*대비\s*\d+(?:\.\d+)?\s*(?:배|%|퍼센트)(?:\s*(?:이상|이하))?/g,
  /약\s*\d+(?:\.\d+)?\s*%\s*(?:이상|이하)?/g,
  /서열번호\s*\d+(?:\s*내지\s*\d+)?/g,
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:조|억|만)\s*(?:원|달러|위안|엔)/g,
  /(?:19|20)\d{2}\s*년/g,
  /\d+(?:\.\d+)?\s*(?:개월|개체|마리|단계|회|kg|mg|ml|μm|nm|cm|mm|°C)\b/g,
  /\d+\s*년(?!대)/g,
  /\d+(?:\.\d+)?\s*(?:%|퍼센트|배|배가량)/g,
];

// ----- (B) Proper-noun / scientific term patterns ----------------------------
const PROPER_PATTERNS: RegExp[] = [
  // 학술적 영문 구: "Fibronectin 1", "Matrix metallopeptidase 7"
  /\b[A-Z][a-z]{2,}(?:\s+[a-z]+){0,3}(?:\s+\d+)?\b/g,
  // ALL-CAPS 약어 (2~6자) + 선택적 숫자 (예: "TRL 6", "TRL-6")
  /\b[A-Z]{2,6}(?:\s*\d+|->\d+|-\d+)?\b/g,
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

// 매칭 결과가 일반 명사구로 적합한지 검증 (동사/형용사 어미·서술어 포함 시 거부)
const SENTENCEY_RE = /(?:다는|라는|어려운|어렵다|쉽다|않다|있다|없다|된다|한다|하다|되다|위해|위한|통해|통한|확보가|확보를|가능한|불가능|때문에|의존|있어|있으며|있고|하여|되어|기반하|따라|관련|사용하여|활용하여)/;

// 구절 '중간'에 등장하는 연결 용언/어미 — 문장형 오버매칭 차단용
const VERB_MIDPHRASE_RE = /(?:제공하며|활발해지며|대응한|어렵다는|해결하고|확보하고|있으며|위한|통해|기반으로|따라)/;

// 한글 음절(가-힣) — 어절 경계 판정에 사용
const HANGUL_SYLLABLE_RE = /[\uAC00-\uD7A3]/;
// 매치 끝이 한국어 접미사(성·적·화·력·률·도) 등 한 글자로 이어져 어절이 잘리는 경우를 막기 위해
// 매치 직후 글자가 한글이면 매칭을 거부한다. 단, 숫자/영문으로 끝나는 매치는 통상 단위 경계가 있어 안전.
function isHangulChar(ch: string | undefined): boolean {
  return !!ch && HANGUL_SYLLABLE_RE.test(ch);
}

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
    const trimmedRaw = raw.trim();
    if (!trimmedRaw || trimmedRaw.length < 2) return false;
    // 매치 길이 상한 — 비정상적으로 긴 캡처(서술어까지 삼킨 경우)는 거부.
    if (trimmedRaw.length > 30) return false;
    // 문장형 오버매칭 차단: 띄어쓰기 2개 이상 + 중간에 연결 용언/어미 포함 시 거부
    const spaceCount = (trimmedRaw.match(/\s/g) || []).length;
    if (spaceCount >= 2 && VERB_MIDPHRASE_RE.test(trimmedRaw)) return false;
    // 어절 경계 보호: 매치 시작 직전이 한글이면 어절 중간 시작 → 거부
    const firstCh = trimmedRaw.charAt(0);
    const beforeCh = start > 0 ? sentence.charAt(start - 1) : "";
    if (isHangulChar(firstCh) && isHangulChar(beforeCh)) return false;

    // 한국어 조사·연결어미·접미사를 ** 바깥으로 밀어내기 (가장 긴 매칭 우선)
    const particleRegex = /(?:으로|에서|이며|하며|하는|되는|성은|선은|은|는|이|가|을|를|에|의|과|와|로|고|며|된|한|적)+$/;
    let targetText = trimmedRaw;
    let suffixText = "";
    const pm = trimmedRaw.match(particleRegex);
    if (pm) {
      suffixText = pm[0];
      targetText = trimmedRaw.slice(0, trimmedRaw.length - suffixText.length);
    }

    const key = targetText.trim();
    if (!key || key.length < 2) return false;
    if (SENTENCEY_RE.test(key)) return false;
    if (paragraphSeen.has(key)) return false;
    if (/^[\s.,;:()[\]{}'"`~!@#$%^&*]+$/.test(key)) return false;

    occupied.push([start, end]);
    inserts.push({ start, end, text: `**${key}**${suffixText}` });
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

    // 병렬 접속사 확장: 사전 표제어가 "A" 일 때, "A 및/과/와/이나/나 B" 형태로
    // 직후에 또 다른 명사가 이어진다면 한 덩어리로 묶어 볼드 처리한다.
    const conjRe = /^\s*(?:및|과|와|이나|나)\s+([가-힣A-Za-z][가-힣A-Za-z0-9]{1,15})/;
    for (const phrase of sorted) {
      if (sentenceBudget <= 0 || paragraphBudget.remaining <= 0) break;
      const idx = sentence.indexOf(phrase);
      if (idx === -1) continue;
      const after = sentence.slice(idx + phrase.length);
      const cm = after.match(conjRe);
      if (!cm) continue;
      const fullLen = phrase.length + cm[0].length;
      tryAdd(idx, idx + fullLen, sentence.slice(idx, idx + fullLen));
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