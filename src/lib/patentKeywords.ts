/**
 * 특허 명칭을 원료·방식·용도로 나눈다. 요약서 '관련 키워드'가 쓴다.
 *   '미생물 발효 유채박을 유효성분으로 함유하는 식물 생장 촉진용 조성물 및 …'
 *     → 원료 '유채박' · 방식 '미생물 발효' · 용도 '식물 생장 촉진' · 형태 '조성물'
 *   '영상 분석을 이용한 작물 생육 관리 방법' → 수단 '영상 분석' · 용도 '작물 생육 관리' · 형태 '방법'
 *   '쌀 단백질을 함유하는 라이스 볼의 제조방법' → 원료 '단백질' · 방식 '쌀' · 제품 '라이스 볼' · 형태 '제조방법'
 *   '콩 들불병 진단용 조성물 및 이의 용도' → 용도 낱말 ['콩', '들불병', '진단'] · 형태 '조성물'
 *   '딸기의 저장, 유통성 향상을 위한 페룰린산 처리 방법' → 대상 '딸기' · 용도 '저장·유통성 향상' · 수단 '페룰린산 처리' · 형태 '방법'
 * 키워드는 낱말로만 내보낸다: '라이스 볼의'처럼 조사가 붙은 꼴은 조사를 떼고 쓴다.
 */
export interface TitleParts {
  /** '…을 포함하는'의 원료(마지막 낱말) */
  subject: string;
  /** 원료 앞의 방식(미생물 발효) */
  way: string;
  /** '…을 이용한'의 수단 묶음(영상 분석) */
  means: string;
  /** '…용'의 용도(식물 생장 촉진) */
  use: string;
  /** '…의 제조방법'처럼 형태 앞 '…의'로 이어진 결과물(라이스 볼) */
  product: string;
  /** '…을'이 없는 명칭에서 '…용' 앞의 낱말들(콩 들불병 진단) */
  useWords: string[];
  /** 명칭 끝의 형태(조성물·방법·장치…) */
  kind: string;
}

const GENERIC_TAIL = /^(추출물|발효물|분말|농축액|혼합물|배양액|배양물|균주|조성물)$/;

/**
 * 낱말 끝의 조사를 뗀다. '가을·마을'처럼 조사와 같은 글자로 끝나는 짧은 낱말은 그대로 둔다.
 */
export function stripParticle(token: string): string {
  const t = token.trim();
  const m = t.match(/^(.+?)(에서|으로|의|를|을|에)$/u);
  if (!m) return t;
  const [, stem, josa] = m;
  if (josa === "의" || josa === "를" || josa === "에서" || josa === "으로") return stem;
  return stem.length >= 2 ? stem : t;
}

/** 여러 낱말 묶음의 각 낱말에서 조사를 뗀다('라이스 볼의' → '라이스 볼') */
export function cleanPhrase(phrase: string): string {
  return phrase.split(/\s+/).filter(Boolean).map(stripParticle).filter(Boolean).join(" ");
}

export function parsePatentTitle(title: string): TitleParts {
  const t = String(title ?? "").replace(/\s*및\s+(그|이의|이를|상기).*$/, "").replace(/\s+/g, " ").trim();
  const out: TitleParts = { subject: "", way: "", means: "", use: "", product: "", useWords: [], kind: t.split(" ").pop() ?? "" };
  const m = t.match(/^(.+?)(?:을|를)\s*(?:유효\s*성분으로\s*)?(포함|함유|이용|사용|첨가|활용)\S*\s+(.+)$/);
  if (m) {
    const words = m[1].split(" ").filter(Boolean).map(stripParticle);
    while (words.length > 1 && GENERIC_TAIL.test(words[words.length - 1])) words.pop();
    // '…을 포함하는'은 마지막 낱말이 원료이고 앞은 방식, '…을 이용한'은 묶음 전체가 수단
    if (/포함|함유|첨가/.test(m[2])) { out.subject = words.pop() ?? ""; out.way = words.join(" "); } else out.means = words.join(" ");
    const use = m[3].match(/^(.+?)용\s/);
    if (use) out.use = cleanPhrase(use[1]);
    else {
      const rest = m[3].split(" ").slice(0, -1);
      // '라이스 볼의 제조방법'처럼 형태 앞이 '…의'로 끝나면 그 묶음은 용도가 아니라 만들어지는 제품이다
      if (rest.length && /의$/.test(rest[rest.length - 1])) out.product = cleanPhrase(rest.join(" "));
      else out.use = cleanPhrase(rest.join(" "));
    }
    return out;
  }
  // '…의 …을 위한 … 방법/시스템': '의' 앞은 대상(원료 자리), 뒤는 용도, '위한' 뒤 형태 앞까지는 수단
  const purpose = t.replace(/\s*\([^)]*\)/g, "").match(/^(.+?)(?:을|를)\s*위한\s+(.+)$/);
  if (purpose) {
    const goal = purpose[1].replace(/\s*,\s*/g, "·");
    const of = goal.match(/^(.+?)의\s+(.+)$/);
    if (of) { out.subject = cleanPhrase(of[1]); out.use = cleanPhrase(of[2]); } else out.use = cleanPhrase(goal);
    const rest = purpose[2].split(" ");
    out.kind = rest.pop() ?? ""; // '…을 위한 조성물'처럼 한 낱말이면 형태만 있고 수단은 없다
    // '… 장치 및 방법'처럼 형태가 둘이면 '및'과 앞 형태도 수단에서 뺀다 ('양액 공급 장치 및'이 키워드가 되지 않게)
    while (rest.length && /^(?:및|또는)$/.test(rest[rest.length - 1])) {
      rest.pop();
      if (rest.length && KIND_WORD.test(rest[rest.length - 1])) rest.pop();
    }
    out.means = cleanPhrase(rest.join(" ").replace(/\s+및\s+/g, "·"));
    return out;
  }
  const use = t.match(/^(.+?)용\s/);
  if (use) out.useWords = use[1].split(" ").filter(Boolean).map(stripParticle);
  return out;
}

const KIND_WORD = /^(?:방법|제조방법|제조법|조성물|시스템|장치|키트|용도|모듈|제형|제제|설비|기구|구조)$/;
const LINK_WORD = /^(?:및|또는|그|이의|이를|상기|위한|관한|본|발명|기반)$/;

/** '종류와'·'드론과'의 이음 조사를 뗀다. 받침 없는 글자 뒤 '와', 받침 있는 글자 뒤 '과'만 조사로 본다(사과·무화과·결과는 그대로) */
function stripAnd(w: string): string {
  const m = w.match(/^(.+)([와과])$/);
  if (!m || m[1].length < 2) return w;
  const code = m[1].charCodeAt(m[1].length - 1) - 0xac00;
  if (code < 0 || code > 11171) return w;
  const hasFinal = code % 28 !== 0;
  return (m[2] === "와") !== hasFinal ? m[1] : w;
}

/**
 * 명칭의 내용 낱말을 앞에서부터 고른다(조사·형태·연결 낱말·'…하는' 꼴 제외).
 * 명칭 형식을 나누지 못할 때 분류 이름보다 먼저 키워드로 쓴다 ('스마트 온실 환기 장치' → 스마트·온실).
 */
export function titleNouns(title: string, max = 2): string[] {
  const words = String(title ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[[\]{}<>"'`,.:;?!]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const raw of words) {
    if (/(?:하는|하기|한|된|되는|있는)$/.test(raw)) continue;
    const w = stripAnd(stripParticle(raw));
    if (w.length < 2 || KIND_WORD.test(w) || LINK_WORD.test(w) || /^\d/.test(w) || out.includes(w)) continue;
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}
