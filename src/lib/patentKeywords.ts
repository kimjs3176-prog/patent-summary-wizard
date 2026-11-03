/**
 * 특허 명칭을 원료·방식·용도로 나눈다. 요약서 '관련 키워드'와 출원지원 '이 기술로 출원 준비'가 함께 쓴다.
 *   '미생물 발효 유채박을 유효성분으로 함유하는 식물 생장 촉진용 조성물 및 …'
 *     → 원료 '유채박' · 방식 '미생물 발효' · 용도 '식물 생장 촉진' · 형태 '조성물'
 *   '영상 분석을 이용한 작물 생육 관리 방법' → 수단 '영상 분석' · 용도 '작물 생육 관리' · 형태 '방법'
 *   '콩 들불병 진단용 조성물 및 이의 용도' → 용도 낱말 ['콩', '들불병', '진단'] · 형태 '조성물'
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
  /** '…을'이 없는 명칭에서 '…용' 앞의 낱말들(콩 들불병 진단) */
  useWords: string[];
  /** 명칭 끝의 형태(조성물·방법·장치…) */
  kind: string;
}

const GENERIC_TAIL = /^(추출물|발효물|분말|농축액|혼합물|배양액|배양물|균주|조성물)$/;

export function parsePatentTitle(title: string): TitleParts {
  const t = String(title ?? "").replace(/\s*및\s+(그|이의|이를|상기).*$/, "").replace(/\s+/g, " ").trim();
  const out: TitleParts = { subject: "", way: "", means: "", use: "", useWords: [], kind: t.split(" ").pop() ?? "" };
  const m = t.match(/^(.+?)(?:을|를)\s*(?:유효\s*성분으로\s*)?(포함|함유|이용|사용|첨가|활용)\S*\s+(.+)$/);
  if (m) {
    const words = m[1].split(" ").filter(Boolean);
    while (words.length > 1 && GENERIC_TAIL.test(words[words.length - 1])) words.pop();
    // '…을 포함하는'은 마지막 낱말이 원료이고 앞은 방식, '…을 이용한'은 묶음 전체가 수단
    if (/포함|함유|첨가/.test(m[2])) { out.subject = words.pop() ?? ""; out.way = words.join(" "); } else out.means = words.join(" ");
    const use = m[3].match(/^(.+?)용\s/);
    out.use = use ? use[1] : m[3].split(" ").slice(0, -1).join(" ");
    return out;
  }
  const use = t.match(/^(.+?)용\s/);
  if (use) out.useWords = use[1].split(" ").filter(Boolean);
  return out;
}
