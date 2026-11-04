/**
 * 특허 명칭을 원료·방식·용도로 나눈다. 요약서 '관련 키워드'가 쓴다.
 *   '미생물 발효 유채박을 유효성분으로 함유하는 식물 생장 촉진용 조성물 및 …'
 *     → 원료 '유채박' · 방식 '미생물 발효' · 용도 '식물 생장 촉진' · 형태 '조성물'
 *   '영상 분석을 이용한 작물 생육 관리 방법' → 수단 '영상 분석' · 용도 '작물 생육 관리' · 형태 '방법'
 *   '쌀 단백질을 함유하는 라이스 볼의 제조방법' → 원료 '단백질' · 방식 '쌀' · 제품 '라이스 볼' · 형태 '제조방법'
 *   '콩 들불병 진단용 조성물 및 이의 용도' → 용도 낱말 ['콩', '들불병', '진단'] · 형태 '조성물'
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
  const m = t.match(/^(.+?)(에서|으로|의|를|을|에|와|과)$/u);
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
  const use = t.match(/^(.+?)용\s/);
  if (use) out.useWords = use[1].split(" ").filter(Boolean).map(stripParticle);
  return out;
}
