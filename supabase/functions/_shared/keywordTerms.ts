// Keyword-only cleanup. Never apply to patent titles, summaries or other prose.
const KEEP_NOUNS = new Set(["가을", "마을", "노을", "저울", "서울", "비닐", "기울", "사과", "무화과", "결과", "효과", "증가", "농가", "단가", "차이", "오이", "종이", "곰팡이", "나이", "파파야", "알로에", "카페", "참외"]);
const STANDALONE = new Set(["은", "는", "이", "가", "을", "를", "의", "에", "에서", "으로", "로", "와", "과", "도", "만", "및", "또는", "이를", "이의", "그", "상기", "위한", "관한"]);

export function cleanKeywordTerm(raw: string): string {
  return raw.trim().split(/\s+/).filter(Boolean).map((word) => {
    if (STANDALONE.has(word)) return "";
    if (KEEP_NOUNS.has(word)) return word;
    // Only explicit case suffixes; ambiguous noun endings 이/가/은/는/로 are
    // never blindly cut. Quoted input and full prose are not passed here.
    const match = word.match(/^(.+?)(으로부터|에서부터|에게서|로부터|에서는|으로는|에게|에서|으로|의|를|을|에는|에)$/u);
    if (!match) return word;
    const [, stem, suffix] = match;
    if (suffix === "을" && stem.length < 2) return word;
    if (suffix === "에" && stem.length < 2) return word;
    return stem;
  }).filter(Boolean).join(" ");
}

export const KEYWORD_NOUN_RULE = "키워드는 조사·연결어 없는 명사 또는 명사구로 출력하세요. 예: 라이스 볼의→라이스 볼, 딸기를→딸기, 쌀로 만든→쌀, 저장을 위한→저장. 단어 자체인 효과·농가·단가·차이·알로에·가을은 절대 자르지 마세요. ‘굳지 않는 떡’처럼 의미에 필수적인 부정 조건은 보존하세요. 출력 전 각 키워드가 독립적인 검색어인지 검토하세요.";