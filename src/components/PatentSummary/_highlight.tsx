import React from "react";
import { sanitizeBoldMarkers } from "@/lib/sanitizeBold";

export function renderBold(text: string) {
  const cleaned = sanitizeBoldMarkers(text);
  const parts = cleaned.split(/(\*{1,3}[^*\n]+\*{1,3})/g);
  const nodes: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    const m = p.match(/^(\*{1,3})([^*\n]+)\1$/);
    if (m) {
      const stars = m[1].length;
      const inner = m[2];
      if (stars === 3) {
        nodes.push(<strong key={`b-${i}`} className="font-bold text-[#191F28]"><em className="italic">{inner}</em></strong>);
      } else if (stars === 2) {
        nodes.push(<strong key={`b-${i}`} className="font-bold text-[#191F28]">{inner}</strong>);
      } else {
        nodes.push(<em key={`b-${i}`} className="italic">{inner}</em>);
      }
    } else if (p) {
      nodes.push(p);
    }
  });
  // 비-볼드 텍스트 노드에 패턴 기반 하이라이트 적용 → 통일된 검은색 볼드 처리
  return highlightImportant(nodes);
}

export type HLType = "money" | "metric" | "superlative" | "solution" | "problem" | "compare" | "concept" | "quote";

export const HL_STYLE: Record<HLType, string> = {
  // 분야 구분 없이 일괄 검은색 볼드 처리
  money:       "font-bold text-[#191F28]",
  metric:      "font-bold text-[#191F28]",
  compare:     "font-bold text-[#191F28]",
  superlative: "font-bold text-[#191F28]",
  solution:    "font-bold text-[#191F28]",
  problem:     "font-bold text-[#191F28]",
  concept:     "font-bold text-[#191F28]",
  quote:       "font-bold text-[#191F28]",
};

export const HL_PATTERNS: { type: HLType; regex: RegExp }[] = [
  { type: "quote",       regex: /([「『"][^「『"\n]{1,30}[」』"])/g },
  { type: "money",       regex: /((?:약\s*)?(?:\d[\d,]*(?:\.\d+)?\s*(?:조|억|만|천)\s*)+(?:\d[\d,]*(?:\.\d+)?\s*)?(?:원|달러|USD|유로|EUR|위안|엔|파운드))/g },
  { type: "money",       regex: /((?:USD|US\$|\$|€|￥|¥)\s?\d[\d,]*(?:\.\d+)?\s?(?:[KMB]|조|억|만|천)?)/g },
  { type: "compare",     regex: /(\d+(?:\.\d+)?\s?(?:배|%|퍼센트|%p|%P|퍼센트포인트)\s*(?:이상|이하)?\s*(?:향상|증가|개선|증대|상승|단축|감소|절감|저감|성장|확대|점유|차지))/g },
  // 숫자+단위 + 선택적 후행어(이상/이하/미만/초과/내외/가량/안팎)를 한 덩어리로 묶어 강조 분절 방지.
  { type: "metric",      regex: /(\d+(?:\.\d+)?\s?(?:%|%p|배|건|년|개월|kg|g|mg|t|톤|mm|cm|km|ml|L|°C|℃|kW|kWh|Hz|MHz|GHz|만원|억원|조원|건당|점|명|곳|종)(?:\s*(?:이상|이하|미만|초과|내외|가량|안팎))?)/g },
  // 범위 표기(예: 1~2년, 5-7%) — 분절되어 강조되지 않도록 통째로 강조.
  { type: "metric",      regex: /(\d+(?:\.\d+)?\s*[~∼–\-]\s*\d+(?:\.\d+)?\s?(?:%|%p|배|건|년|개월|kg|g|mg|t|톤|mm|cm|km|ml|L|°C|℃|만원|억원|조원|점|명|곳|종))/g },
  { type: "superlative", regex: /(세계\s*최초|국내\s*최초|업계\s*최초|세계\s*최고|국내\s*최고|세계\s*유일|국내\s*유일|독보적인?|차별화된|혁신적인?|획기적인?|최고\s*수준|최상위|유일한|독점적인?|핵심\s*관건|핵심\s*요인|핵심\s*기술|원천\s*기술|진입\s*장벽)/g },
  { type: "concept",     regex: /((?:인공지능|AI|객체\s*탐지|영상\s*분석|무인\s*비행장치|드론|열화상|초분광|근적외선|라이다|LiDAR|스마트\s*방제|유해\s*생물\s*모니터링|병해충\s*예찰|농업용\s*드론|스마트\s*농업|재난\s*안전)(?:\s*(?:기반|활용|결합|탐지|분석|제어|관리|시장|시스템|솔루션|장치|기술|분야|모듈))?)/g },
  { type: "solution",    regex: /([가-힣A-Za-z0-9()·\s]{2,28}(?:자동\s*탐지|원격\s*탐색|실시간\s*분석|위치\s*파악|경로\s*자동\s*생성|다각도\s*영상\s*촬영|피해\s*예방|안전\s*확보|방제\s*계획\s*수립))/g },
  { type: "solution",    regex: /([가-힣A-Za-z0-9()·\s]{2,24}(?:을|를)\s*(?:조기\s*탐지|자동\s*탐지|원격\s*탐색|실시간\s*분석|정확하게\s*파악|신속하게\s*공유|효율적으로\s*방제|획기적으로\s*개선|예방|확보|최적화|강화|극대화))/g },
  { type: "problem",     regex: /(?:^|[\s,.;:()「『"])([가-힣]{2,8}(?:의)?\s*(?:문제점?|한계점?|어려움|단점|취약점|결함|리스크))/g },
  // 의미 있는 "(선행명사 )X을/를 [부사] + 동사" 구. 띄어쓰기로 분절된 선행 수식어와 사이 부사(정밀하게/효과적으로/근본적으로/고농도로 등)를 포함해 통째로 강조.
  // 의미가 빈약한 "제공"은 verb 목록에서 제외(별도 패턴으로 의미가 풍부할 때만 잡음).
  { type: "solution",    regex: /(?:^|[\s,.;:()「『"])((?:[가-힣]{1,8}\s+)?[가-힣]{2,12}(?:을|를)\s*(?:[가-힣]{2,8}(?:으로|하게|적으로|히|이)\s+)?(?:해결|극복|개선|달성|확보|구현|실현|돌파|상용화|국산화|대체|강화|향상|극대화|최적화|증대|확대|단축|절감|활용|관리|개발|공급|적용|도입|추진|제시|추출|분리|방지|억제|충족|회복|차단))/g },
  // "X을/를 활용한 Y" — 2-프로판올을 활용한 ... 공정 등.
  { type: "solution",    regex: /([가-힣A-Za-z0-9\-()·]{2,16}(?:을|를)\s*활용한\s+[가-힣A-Za-z0-9()·\s]{2,24}(?:공정|기술|시스템|방법|모델|소재|원료|체계|전략|솔루션))/g },
  // "X을 대체할 수 있는 Y" — 합성 의약품의 부작용을 대체할 수 있는 천연 추출물 기반 등.
  { type: "solution",    regex: /([가-힣A-Za-z0-9()·\s]{2,24}(?:을|를)\s*대체할\s*수\s*있는\s+[가-힣A-Za-z0-9()·\s]{2,24}(?:기반|소재|원료|기술|솔루션|치료제|예방제|모델))/g },
  // "X을 넘어 Y" — 단순 식재료 공급을 넘어 고부가가치 원료 공급처 등.
  { type: "compare",     regex: /([가-힣A-Za-z0-9()·\s]{2,24}(?:을|를)\s*넘어\s+[가-힣A-Za-z0-9()·\s]{2,24}(?:공급처|시장|영역|모델|체계|구조|소재|원료|단계))/g },
  // "X을/를 위한 Y" — 대사 증후군 예방을 위한 영양학적 응용 영역 등.
  { type: "concept",     regex: /([가-힣A-Za-z0-9()·\s]{2,24}(?:을|를)\s*위한\s+[가-힣A-Za-z0-9()·\s]{2,24}(?:영역|영역으로|시장|모델|체계|기반|소재|원료|전략|솔루션|응용\s*영역))/g },
  // "X 환자가 증가" — 비알코올성 지방간 환자가 증가함 등.
  { type: "problem",     regex: /([가-힣A-Za-z0-9()·\s]{2,20}\s*환자가\s*(?:급?증가|늘어남|확대됨|급증|증가)(?:함|하고\s*있음|하는\s*추세)?)/g },
  // "X 조건이 충족" — 대량 재배 단지 조성과 품질 표준화 조건이 충족 등.
  { type: "solution",    regex: /([가-힣A-Za-z0-9()·\s]{2,32}(?:조건|요건|기반|준비)(?:이|가)\s*충족(?:될|되어|된\s*상태)?)/g },
  // "X(가|이) 주도" — 실리마린 등 ... 소재가 주도 등.
  { type: "concept",     regex: /([가-힣A-Za-z0-9()·\s]{2,28}(?:가|이)\s*주도(?:하고\s*있음|하는|함|한다)?)/g },
  // "N% 에탄올 처리" — 80% 에탄올 처리 등 정량 + 시약/공정 표현.
  { type: "metric",      regex: /(\d+(?:\.\d+)?%\s*[가-힣A-Za-z]{2,12}\s*처리)/g },
  // "치료하는 해결책 / 예방하는 방안" 같이 띄어쓰기로 분절돼 일부만 잡히던 구 보강.
  { type: "solution",    regex: /([가-힣]{2,8}하는\s*(?:해결책|해법|방안|대안|돌파구))/g },
  { type: "solution",    regex: /([가-힣]{2,10}(?:화|성)된\s*(?:기술|시스템|공법|방식|구조|솔루션))/g },
  // "예방 및/·/와 치료제 개발" 같이 연결어로 묶인 효익 구.
  { type: "solution",    regex: /((?:예방|치료|진단|관리|개선)\s*(?:및|·|와|과)\s*(?:치료제|예방제|진단키트|관리\s*체계|관리\s*방안)\s*개발)/g },
  // "기존 X 대비 ... 우수/향상/단축/절감" 비교 우위 표현.
  { type: "compare",     regex: /(기존\s+[가-힣A-Za-z0-9()·\s]{2,20}\s*대비\s+[가-힣A-Za-z0-9()·\s]{2,30}(?:우수|향상|개선|증가|단축|절감|뛰어남|월등함))/g },
  // "공정 확립이 완료된 상태" 등 "X(이|가) 완료된 상태/단계".
  { type: "solution",    regex: /([가-힣A-Za-z0-9()·\s]{2,20}(?:이|가)\s*완료된\s*(?:상태|단계))/g },
  // "공고히 하는 상생 모델 / 기반을 다지는 협력 체계" 등 "X하는 Y 모델/체계/구조".
  { type: "concept",     regex: /([가-힣]{2,8}(?:히|이)?\s*하는\s+[가-힣A-Za-z0-9]{2,10}\s+(?:모델|체계|구조|전략|솔루션))/g },
  // "X 위험 / X 한계 / X 구조 / X 모델" 등 단일명사 강조가 어색하므로, 앞의 수식어를 포함하여 통째로 강조.
  { type: "concept",     regex: /([가-힣A-Za-z0-9]{2,10}(?:\s+[가-힣A-Za-z0-9]{2,10}){1,3}\s+(?:위험|한계|구조|모델|체계|시장|생태계|기반|공정|회수율|효능|치료제|소비\s*구조|수익\s*구조|공급\s*모델|원료\s*공급|추출\s*공정))/g },
  // -------------------------------------------------------------------------
  // 사용자 정의 규칙 (특허 명세서 요약 6대 카테고리)
  // 1) 기술 핵심 개념: "SNP 마커 기술", "분자마커 기반 선발 기술", "HRM 분석법"
  { type: "concept",     regex: /((?:[A-Z]{2,6}|[가-힣A-Za-z0-9]{2,12})(?:\s+[가-힣A-Za-z0-9]{1,10}){0,2}\s+(?:마커\s*기술|분석법|분석\s*기술|선발\s*기술|예측\s*방법|예측\s*모델|진단\s*키트|육종\s*시스템|선발\s*시스템|프라이머\s*세트|평가\s*기법|판별\s*기법|검출\s*기법|판별\s*기술|검출\s*기술|기반\s*기술))/g },
  // 2) 해결 문제: "수개월의 검증 기간", "대규모 노동력 소요", "병 저항성 판별의 어려움"
  { type: "problem",     regex: /(수개월(?:의)?\s*[가-힣]{2,8}\s*기간)/g },
  { type: "problem",     regex: /(대규모\s*[가-힣]{2,8}(?:\s*소요|\s*투입|\s*필요))/g },
  { type: "problem",     regex: /([가-힣A-Za-z0-9]{2,10}(?:\s+[가-힣A-Za-z0-9]{2,10}){0,2}\s*판별(?:의)?\s*(?:어려움|난점|한계))/g },
  // 3) 핵심 해결 수단: "12개 SNP 마커", "유전자형 예측 방법", "비교유전체 분석 기술"
  { type: "solution",    regex: /(\d+개\s*(?:SNP|InDel|SSR|CAPS|[A-Z]{2,6})?\s*마커)/g },
  { type: "solution",    regex: /(전용\s*프라이머\s*세트)/g },
  // 4) 정량 정보 보강: "1~12번 서열번호", "수백 개 샘플 동시 분석"
  { type: "metric",      regex: /(\d+\s*[~∼–\-]\s*\d+\s*번\s*서열번호)/g },
  { type: "metric",      regex: /(수[백천만]\s*개?\s*(?:샘플|마커|품종|개체|유전자)(?:\s*동시\s*분석)?)/g },
  // 5) 주요 효과: "분석 시간 단축", "육종 효율 향상", "정확도 향상", "재현성 확보", "현장 적용성 증대"
  { type: "solution",    regex: /([가-힣A-Za-z0-9]{2,8}\s*(?:시간|효율|정확도|민감도|특이도|재현성|적용성|생산성|수율|안정성|신뢰성|완성도|편의성)\s*(?:단축|향상|확보|증대|개선|제고|상승))/g },
  // 6) 활용 분야: "종자 육종 기업", "분자진단 키트", "농업 바이오 산업", "품종 선발 시스템"
  { type: "concept",     regex: /([가-힣A-Za-z0-9]{2,10}(?:\s+[가-힣A-Za-z0-9]{2,10}){0,2}\s+(?:육종\s*기업|진단\s*키트|바이오\s*산업|선발\s*시스템|관리\s*시스템|진단\s*시장|육종\s*산업|종자\s*시장|식품\s*산업))/g },
];

interface HLMatch { start: number; end: number; type: HLType; text: string; weight?: number; }

// 의미가 약한 디스코스 마커/필러 — 강조 대상에서 제외.
// "이 기술", "주된 기술", "본 기술/발명" 등 지시·관형 수식 + 일반명사 단독은 강조 가치가 없음.
const FILLER_RE = /^(?:현재\s*)?(?:본|이|그|해당|동|주된|주요|일반|단순)?\s*(?:기술|발명|특허|연구|논문|장치|시스템|모델|구조|방식|방법|단계|분야|영역|구성|형태|형식|내용|결과|효과|기능|성능)$/;
const DISCOURSE_PREFIX_RE = /^(?:현재|향후|기존|기존의|결론적으로|종합적으로|전반적으로|단기적으로|중기적으로|장기적으로|특히|또한|그리고|따라서|이는|이러한|이와\s*같이|한편|반면|또는|또|그러나|하지만|즉|만약|뿐만\s*아니라)\s+/;
// 매치 시작부에서 잘라내야 하는 조사·접속사·디스코스 마커 (start 오프셋 보정).
const LEADING_TRIM_RE = /^(?:현재|향후|기존|기존의|결론적으로|종합적으로|전반적으로|단기적으로|중기적으로|장기적으로|특히|또한|그리고|따라서|이는|이러한|이와\s*같이|한편|반면|또는|또|그러나|하지만|즉|만약|뿐만\s*아니라|에서|에는|에도|에게|에서는|에서도|내에|내에서|동안|만큼|보다|처럼|부터|까지|마다|조차|로서|로써|이며|이고|이나|이라|에|와|과|로|으로|의|은|는|이|가|을|를|빠르게|크게|널리|매우|특히)\s+/;
// 매치가 동사 활용형(어미)로 시작하면 자연스럽지 않음 → 폐기.
const LEADING_VERB_RE = /^(?:[가-힣]{2,10})(?:하여|되어|하며|되며|하고|되고|하면서|되면서|함으로써|됨으로써|한다면|된다면|한다는|된다는|다는|하면|되면|할\s|될\s|하는\s|되는\s|한\s|된\s|하기|되기)/;
// 매치 본문에 줄바꿈이 포함되면 폐기.
const CROSS_LINE_RE = /[\r\n]/;
// "본 기술/발명/특허"로 시작하는 매치 폐기.
const LEADING_SELF_REF_RE = /^(?:(?:현재\s*)?(?:본|이|그|해당|동)\s*)?(?:기술|발명|특허)(?:은|는|이|가|을|를|의|에|로)?(?:\s|$)/;

// =============================================================================
// 출력 검증(Output validation) — 사용자 정의 "절대 금지 규칙"
// -----------------------------------------------------------------------------
// Bold 적용 후보가 다음 중 하나라도 해당하면 폐기한다.
//   (a) 조사/접속어로 시작 또는 종료
//   (b) 동사 활용형(어미)으로 종료 — "기반한", "한정된", "예측하는", "될 것이며" 등
//   (c) 일반 표현으로 종료 — "것이다", "가능하다", "기반한", "것이며", "것으로"
//   (d) 의미 단위가 불완전 — 어절이 1개뿐이고 명사가 아닌 부사·동사 어간만 남는 경우
// =============================================================================

// 종료 어미(동사 활용형) — 매치 끝이 이 패턴이면 "문장 중간 잘림"으로 간주.
// 단, 명사 뒤에 자연스럽게 붙는 "-된 / -한 / -하는 / -되는" 활용은 뒤에 다른 명사가
// 이어져야 하는데 매치가 거기서 끝나버린 경우(예: "기반한", "한정된", "예측하는")만 폐기.
const TRAILING_VERB_TAIL_RE = /(?:[가-힣]{1,8})(?:하는|되는|한|된|하여|되어|하며|되며|하고|되고|함으로써|됨으로써|하면|되면|할|될|기반한|한정된|예측하는|기반으로|기반한다|것이며|것이다|것으로|가능하다|가능하며|될\s*것이며|될\s*것이다)$/;

// 종료 조사/접속어 — 매치 끝이 순수 조사/접속어로 끝나면 폐기.
const TRAILING_PARTICLE_RE = /(?:[은는이가을를의에서와과로으로에게부터까지마다처럼보다조차]|및|또는|혹은|그리고|따라서|즉|등의|등을|등이|등은)$/;

// 시작 어미·부사·접속어 (보강) — "신속하게", "정밀하게", "효과적으로" 등 부사 단독 시작 폐기.
const LEADING_ADVERB_RE = /^(?:[가-힣]{2,8}(?:하게|되게|적으로|스럽게|롭게|이|히))\s+/;

// 일반 표현(의미 약한 상투어) — 매치에 이 표현이 포함되면 폐기.
const GENERIC_PHRASE_RE = /(?:것이다|것이며|것으로|가능하다|가능하며|될\s*것|할\s*수\s*있다|할\s*수\s*있는|기반한(?!\s*[가-힣])|한정된(?!\s*[가-힣])|예측하는(?!\s*[가-힣]))/;

/**
 * 최종 출력 검증. 통과해야만 Bold 후보로 인정.
 * 반환: true=유효, false=폐기.
 */
function isValidHighlightPhrase(phrase: string): boolean {
  const p = phrase.trim();
  if (p.length < 3) return false;
  // (a) 조사/접속어로 시작·종료
  if (LEADING_TRIM_RE.test(p + " ")) return false;
  if (LEADING_ADVERB_RE.test(p + " ")) return false;
  if (TRAILING_PARTICLE_RE.test(p)) return false;
  // (b) 동사 활용형으로 종료
  if (TRAILING_VERB_TAIL_RE.test(p)) return false;
  // (c) 일반 표현 포함
  if (GENERIC_PHRASE_RE.test(p)) return false;
  // (d) 어절이 1개뿐인 경우 — 단일 명사/약어/정량값만 허용
  const words = p.split(/\s+/);
  if (words.length === 1) {
    // 한글 단일 어절은 명사형(받침 또는 명사 접미사)만 허용. 조사·동사형은 위에서 제외됨.
    // 영문 약어(SNP, HRM 등)와 정량값(\d 포함)은 허용.
    if (/^[A-Z0-9][A-Z0-9\-\/]*$/.test(p)) return true;
    if (/\d/.test(p)) return true;
    // 한글 단어 단독은 너무 짧으면 폐기
    if (p.length < 4) return false;
  }
  return true;
}

// 종료부의 조사·일반어미를 잘라낸다(시도 1회). 잘라낸 뒤 다시 검증.
function trimTrailingNoise(s: string): string {
  let out = s;
  // 후행 공백 정리
  out = out.replace(/\s+$/, "");
  // 후행 조사 제거 (단, 명사 뒤 1글자 조사만)
  out = out.replace(/([가-힣A-Za-z0-9])(?:[은는이가을를의]|에서|에게|으로|로|와|과)$/u, "$1");
  // 후행 일반 표현 제거
  out = out.replace(/\s*(?:것이다|것이며|것으로|가능하다|가능하며|기반한|한정된|예측하는)$/u, "");
  return out.trim();
}


// 의미가 빈약하거나 사용자가 명시적으로 제외 요청한 표현 — 매치되더라도 강조하지 않음.
// 예) "거듭날 기회를 제공", "차별적 효과를 제공" 같은 상투적 효익 표현,
//     "수치는 2021년의 52억 달러 시장" 처럼 본문 흐름상 강조 가치가 낮은 수치 인용.
const EXCLUDE_MATCH_RE = /(?:거듭날\s*기회|차별적\s*효과|기회를\s*제공|효과를\s*제공)/;
const EXCLUDE_CONTEXT_RE = /수치는\s*$/;
// IPC 분류 코드(예: A61K, A61K 36/00, A61P 35/00) — 강조 대상에서 제외.
const IPC_CODE_RE = /\b[A-H]\d{2}[A-Z](?:\s?\d+\/\d+)?\b/;
// 시작 위치 바로 앞이 영문 대문자(IPC 코드의 'A' 등)이면 부분 매치 — 폐기.
const IPC_PRECEDING_RE = /[A-H]$/;

// ---------------------------------------------------------------------------
// 런타임 동적 규칙: 관리자 승인된 제외/추가 문구.
// useHighlightRules() 훅이 로드한 결과를 setRuntimeHighlightRules()로 주입.
// ---------------------------------------------------------------------------
let RUNTIME_EXCLUDES: string[] = [];
let RUNTIME_INCLUDES: { phrase: string; weight: number }[] = [];
// 사전 컴파일된 RUNTIME_INCLUDES 정규식 (collectMatches 호출마다 new RegExp 비용 제거)
let RUNTIME_INCLUDE_REGEXES: { re: RegExp; weight: number }[] = [];
// 사전 정규화된 RUNTIME_EXCLUDES (공백 제거 버전 캐시)
let RUNTIME_EXCLUDE_NORMALIZED: string[] = [];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function setRuntimeHighlightRules(
  rules: { kind: "exclude" | "include"; phrase: string; weight?: number }[],
) {
  RUNTIME_EXCLUDES = [];
  RUNTIME_INCLUDES = [];
  RUNTIME_INCLUDE_REGEXES = [];
  RUNTIME_EXCLUDE_NORMALIZED = [];
  for (const r of rules) {
    const p = (r.phrase || "").trim();
    if (!p) continue;
    if (r.kind === "exclude") {
      RUNTIME_EXCLUDES.push(p);
      const np = p.replace(/\s+/g, "");
      if (np) RUNTIME_EXCLUDE_NORMALIZED.push(np);
    } else {
      const weight = Math.min(3, Math.max(1, r.weight ?? 2));
      RUNTIME_INCLUDES.push({ phrase: p, weight });
      const flexible = p.split(/\s+/).filter(Boolean).map(escapeRegExp).join("\\s+");
      if (flexible) RUNTIME_INCLUDE_REGEXES.push({ re: new RegExp(flexible, "g"), weight });
    }
  }
}

function matchesRuntimeExclude(text: string): boolean {
  if (RUNTIME_EXCLUDE_NORMALIZED.length === 0) return false;
  const norm = text.replace(/\s+/g, "");
  return RUNTIME_EXCLUDE_NORMALIZED.some((np) => norm.includes(np));
}

function trimTrailingParticle(s: string): string {
  return s.replace(/[\s]*[은는이가을를의에서와과로으로]+$/u, "").trim();
}

export function collectMatches(text: string): HLMatch[] {
  const all: HLMatch[] = [];
  // 0) 관리자가 승인한 'include' 문구를 강제 매치(공백 유연 매칭)
  for (const item of RUNTIME_INCLUDE_REGEXES) {
    const re = item.re;
    re.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text)) !== null) {
      if (!mm[0]) { re.lastIndex++; continue; }
      // IPC 코드는 런타임 규칙에서도 제외
      if (IPC_CODE_RE.test(mm[0])) continue;
      all.push({ start: mm.index, end: mm.index + mm[0].length, type: "solution", text: mm[0], weight: item.weight });
    }
  }
  for (const { type, regex } of HL_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      const rawGroup = m[1] || m[0];
      const rawMatched = rawGroup.trim();
      // 1) 디스코스 접두어 제거 후 평가 ("결론적으로 본 기술" → "본 기술")
      const stripped = rawMatched.replace(DISCOURSE_PREFIX_RE, "").trim();
      // 2) 일반명사 단독/필러는 제외 ("본 기술", "본 발명", "모델", "구조", "기술 이전" 등)
      if (!stripped || FILLER_RE.test(stripped)) continue;
      if (/(통해\s*개발된\s*만큼\s*기술|본\s*기술|본\s*발명|본\s*특허|농업\s*분야에서\s*본\s*기술)$/.test(rawMatched)) continue;
      // 3) 후행 조사가 그대로 매치된 경우 잘라낸다 ("확보가 상용화" → 잘라도 의미 흐려지면 폐기)
      const matchedText = rawMatched;
      // 매치 본문이 결국 필러로 끝나면 제외
      if (FILLER_RE.test(trimTrailingParticle(matchedText))) continue;
      // 캡처 그룹의 원위치 + trim으로 잘린 선행 공백만큼 보정
      const offset = m[0].indexOf(rawGroup);
      const leadingWs = rawGroup.length - rawGroup.trimStart().length;
      let start = m.index + Math.max(0, offset) + leadingWs;
      let workText = matchedText;
      // 매치 시작부의 조사/접속사/디스코스 마커를 잘라내고 start 보정 (반복 적용).
      for (let i = 0; i < 3; i++) {
        const lm = workText.match(LEADING_TRIM_RE);
        if (!lm) break;
        start += lm[0].length;
        workText = workText.slice(lm[0].length);
      }
      if (workText.length < 2) continue;
      // 정제된 본문 재평가
      if (FILLER_RE.test(workText) || FILLER_RE.test(trimTrailingParticle(workText))) continue;
      if (LEADING_SELF_REF_RE.test(workText)) continue;
      if (LEADING_VERB_RE.test(workText)) continue;
      if (CROSS_LINE_RE.test(workText)) continue;
      // 시작 직전 문자가 한글이면 단어 일부만 잡힌 것 → 폐기 ("고부가가치" → "부가가치")
      const prevChar = text.charAt(start - 1);
      if (/[가-힣]/.test(prevChar)) continue;
      // 시작 직전이 IPC 코드의 영문 대문자(A-H)면 IPC 부분 매치 → 폐기 ("A23L" → "23L")
      if (IPC_PRECEDING_RE.test(prevChar)) continue;
      // 4) 명시 제외 문구는 폐기.
      if (EXCLUDE_MATCH_RE.test(workText)) continue;
      // 4-a) IPC 분류 코드 포함 시 폐기.
      if (IPC_CODE_RE.test(workText)) continue;
      // 4-b) 런타임 승인된 'exclude' 문구와 겹치면 폐기.
      if (matchesRuntimeExclude(workText)) continue;
      // 5) 직전 컨텍스트 기반 제외 ("수치는 ... 52억 달러 시장" 류).
      const preceding = text.slice(Math.max(0, start - 12), start);
      if (EXCLUDE_CONTEXT_RE.test(preceding)) continue;
      all.push({ start, end: start + workText.length, type, text: workText });
    }
  }
  all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const filtered: HLMatch[] = [];
  let cursor = 0;
  for (const m of all) {
    if (m.start < cursor) continue;
    filtered.push(m);
    cursor = m.end;
  }
  return applyDensityCaps(filtered, text);
}

// 우선순위(낮을수록 우선): 정량(metric/money/compare) > 차별성(superlative) >
// 핵심개념(concept) > 해결수단(solution) > 문제(problem) > 인용(quote)
const TYPE_PRIORITY: Record<HLType, number> = {
  metric: 1, money: 1, compare: 1,
  superlative: 2,
  concept: 3,
  solution: 4,
  problem: 5,
  quote: 6,
};

/**
 * 사용자 정의 강조 비율 규칙:
 *  - 한 문장 내 최대 2개
 *  - 인접 문장을 연속으로 Bold 처리하지 않음 (직전 문장이 Bold면 다음 문장 스킵)
 *  - 전체 텍스트의 15%를 초과하지 않음
 *  - 충돌 시 우선순위(TYPE_PRIORITY)로 선택
 */
function applyDensityCaps(matches: HLMatch[], text: string): HLMatch[] {
  if (matches.length === 0) return matches;
  // 문장 경계 인덱스 사전 계산
  const breaks: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    // .  !  ?  。  ．  ！  ？  \n
    if (ch === 46 || ch === 33 || ch === 63 || ch === 0x3002 || ch === 0xFF0E || ch === 0xFF01 || ch === 0xFF1F || ch === 10) {
      breaks.push(i + 1);
    }
  }
  if (breaks[breaks.length - 1] !== text.length) breaks.push(text.length);
  const sentenceOf = (pos: number) => {
    // breaks[i] = sentence i 시작 위치. 마지막 항목은 text.length.
    let lo = 0, hi = breaks.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (breaks[mid] <= pos) lo = mid; else hi = mid;
    }
    return lo;
  };

  // 문장별로 후보 그룹화
  const groups = new Map<number, HLMatch[]>();
  for (const m of matches) {
    const idx = sentenceOf(m.start);
    if (!groups.has(idx)) groups.set(idx, []);
    groups.get(idx)!.push(m);
  }

  const maxBoldedChars = Math.floor(text.length * 0.15);
  const final: HLMatch[] = [];
  let boldedChars = 0;
  let lastBoldedSentence = -2;
  const sortedIdx = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const sIdx of sortedIdx) {
    // 인접 문장 연속 강조 금지 — 단, 직전 문장과 1칸 차이일 때만 스킵
    if (sIdx === lastBoldedSentence + 1) continue;
    const cands = groups.get(sIdx)!.slice().sort((a, b) => {
      const pa = TYPE_PRIORITY[a.type] ?? 9;
      const pb = TYPE_PRIORITY[b.type] ?? 9;
      if (pa !== pb) return pa - pb;
      // 같은 우선순위 → 더 긴 의미 단위 우선
      return (b.end - b.start) - (a.end - a.start);
    });
    let picked = 0;
    const pickedRanges: HLMatch[] = [];
    for (const c of cands) {
      if (picked >= 2) break;
      // 같은 문장 내 위치 겹침 방지
      if (pickedRanges.some((p) => c.start < p.end && c.end > p.start)) continue;
      // 15% 총량 캡
      if (boldedChars + (c.end - c.start) > maxBoldedChars) continue;
      pickedRanges.push(c);
      picked++;
      boldedChars += c.end - c.start;
    }
    if (pickedRanges.length > 0) {
      // 원위치 순서로 다시 정렬해 푸시
      pickedRanges.sort((a, b) => a.start - b.start);
      final.push(...pickedRanges);
      lastBoldedSentence = sIdx;
    }
  }
  return final;
}

export function highlightImportant(nodes: React.ReactNode[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let key = 0;
  for (const node of nodes) {
    if (typeof node !== "string") { out.push(node); continue; }
    const text = node;
    const matches = collectMatches(text);
    if (matches.length === 0) { out.push(text); continue; }
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) out.push(text.slice(cursor, m.start));
      // 방어: m.text 대신 원문 슬라이스를 사용해 문자 누락/중복 가능성을 원천 차단.
      const sliced = text.slice(m.start, m.end);
      out.push(
        <mark
          key={`hl-${key++}`}
          className={`bg-transparent ${
            m.weight === 1
              ? "font-semibold text-[#191F28]"
              : m.weight === 3
              ? "font-extrabold text-[#191F28] underline decoration-2 decoration-emerald-500 underline-offset-2"
              : HL_STYLE[m.type]
          }`}
        >
          {sliced}
        </mark>,
      );
      cursor = m.end;
    }
    if (cursor < text.length) out.push(text.slice(cursor));
  }
  return out;
}