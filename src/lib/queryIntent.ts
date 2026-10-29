// Classifies what someone typed into the home search box so one input can serve every style:
//   number / batch → open the patent summary (or batch lookup)
//   keyword        → broad keyword search (1–2 words, e.g. "발효", "김치 유산균")
//   sentence       → strict sentence search (needs described in words, e.g. "음식 기름 제거")
//   question       → conversational assistant (asks something, e.g. "요새 활용하면 좋은 기술 있을까?")
// The keyword/sentence split mirrors isNaturalLanguageQuery in supabase/functions/search-patents/index.ts —
// keep the two in step so the label shown here matches how the server actually searches.
import { isBatchNumberInput, parseIpNumber } from "@/lib/ipNumber";

export type QueryIntent = "empty" | "number" | "batch" | "keyword" | "sentence" | "question";

const TRAILING = /[\s.!~…^]+$/u;

/** Words that only make sense when asking someone something. */
const ASK_WORD = /(^|\s)(뭐|뭘|무엇|무슨|어디|어떤|어떻게|어느|언제|왜|누가|누구|몇|얼마)/u;
/** Request / question endings ("추천해줘", "있을까", "받나요", "알려 주세요"). */
const ASK_ENDING = /(줘|줄래|주세요|주실래요|주시겠어요|알려\s?줄래|있을까요?|있나요?|있니|있어요?\?|없을까요?|없나요?|할까요?|될까요?|일까요?|인가요?|인지요?|나요|까요|가요|니까|습니까|던가요?|ㄹ까|래요\?)$/u;
/** Topics the assistant answers from statistics or the transfer guide rather than a patent list. */
const ASSISTANT_TOPIC = /(기술\s?이전|이전\s?받|무상\s?이전|라이선스|요즘|요새|트렌드|출원\s?동향|(늘어난|증가한|뜨는|유망한|인기\s?있는)\s*(분야|기술)|(첫|두|세|네|다섯)\s?번째)/u;

const NL_ENDING = /[다음임요죠네게려고싶]+$/u;
const NL_PATTERNS = [
  /[고을를이가에서로의은는]+\s/u, /싶[다음어으]/u, /하고\s/u, /찾[기고아]/u, /검토/u, /도입/u, /방법/u,
  /어떻게/u, /늘리/u, /줄이/u, /개선/u, /해결/u, /필요/u, /가능/u, /[?？]/u,
];

export function classifyQuery(raw: string): QueryIntent {
  const text = raw.trim();
  if (!text) return "empty";
  if (isBatchNumberInput(text)) return "batch";
  if (parseIpNumber(text)) return "number";

  const core = text.replace(TRAILING, "");
  if (/[?？]/u.test(core) || ASK_WORD.test(core) || ASK_ENDING.test(core) || ASSISTANT_TOPIC.test(core)) {
    return "question";
  }

  const words = core.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !NL_ENDING.test(core)) return "keyword";
  if (words.length >= 3) return "sentence";
  return NL_PATTERNS.some((p) => p.test(core)) ? "sentence" : "keyword";
}

export const INTENT_HINT: Record<Exclude<QueryIntent, "empty">, { label: string; detail: string }> = {
  number: { label: "특허번호", detail: "바로 AI 요약을 만듭니다" },
  batch: { label: "여러 특허번호", detail: "한 번에 일괄 조회합니다" },
  keyword: { label: "키워드 검색", detail: "관련 특허를 넓게 찾습니다" },
  sentence: { label: "문장 검색", detail: "핵심 조건이 맞는 특허만 보여줍니다" },
  question: { label: "질문", detail: "AI 상담이 특허·통계로 답해 드려요" },
};
