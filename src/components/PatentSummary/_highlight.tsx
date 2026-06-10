import React from "react";
import { sanitizeBoldMarkers } from "@/lib/sanitizeBold";

export function renderBold(text: string) {
  const cleaned = sanitizeBoldMarkers(text);
  const parts = cleaned.split(/(\*{1,3}[^*\n]+\*{1,3})/g);
  return parts.map((p, i) => {
    const m = p.match(/^(\*{1,3})([^*\n]+)\1$/);
    if (m) {
      const stars = m[1].length;
      const inner = m[2];
      if (stars === 3) {
        return <strong key={i} className="font-semibold text-[#191F28]"><em className="italic">{inner}</em></strong>;
      }
      if (stars === 2) {
        return <strong key={i} className="font-semibold text-[#191F28]">{inner}</strong>;
      }
      return <em key={i} className="italic">{inner}</em>;
    }
    return <span key={i}>{p}</span>;
  });
}

export type HLType = "money" | "metric" | "superlative" | "solution" | "problem" | "compare" | "concept" | "quote";

export const HL_STYLE: Record<HLType, string> = {
  money:       "font-bold text-[#0B7C5C] bg-[#10B98129] px-1.5 rounded-[5px] tabular-nums ring-1 ring-[#10B98140]",
  metric:      "font-bold text-[#0B7C5C] bg-[#10B9811F] px-1 rounded-[4px] tabular-nums",
  compare:     "font-bold text-[#0B7C5C] bg-[#10B98124] px-1 rounded-[4px]",
  superlative: "font-bold text-[#B45309] bg-[#FEF3C7] px-1 rounded-[4px]",
  solution:    "font-semibold text-[#047857] bg-[#10B9811A] px-1 rounded-[4px] decoration-[#10B98166] decoration-1 underline underline-offset-[3px]",
  problem:     "font-semibold text-[#B91C1C] bg-[#FEE2E21F] px-1 rounded-[4px] decoration-[#FCA5A5] decoration-1 underline underline-offset-[3px]",
  concept:     "font-semibold text-[#191F28] bg-[#F2F4F6] px-1 rounded-[4px] decoration-[#CBD5E1] decoration-dotted underline underline-offset-[3px]",
  quote:       "font-semibold text-[#191F28] bg-[#F2F4F6] px-1 rounded-[4px]",
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
];

interface HLMatch { start: number; end: number; type: HLType; text: string; }

// 의미가 약한 디스코스 마커/필러 — 강조 대상에서 제외.
// "이 기술", "주된 기술", "본 기술/발명" 등 지시·관형 수식 + 일반명사 단독은 강조 가치가 없음.
const FILLER_RE = /^(?:현재\s*)?(?:본|이|그|해당|동|주된|주요|일반|단순)?\s*(?:기술|발명|특허|연구|논문|장치|시스템|모델|구조|방식|방법|단계|분야|영역|구성|형태|형식|내용|결과|효과|기능|성능)$/;
const DISCOURSE_PREFIX_RE = /^(?:현재|향후|기존|결론적으로|종합적으로|전반적으로|단기적으로|중기적으로|장기적으로|특히|또한|그리고|따라서|이는|이러한|이와\s*같이|한편|반면)\s+/;

// 의미가 빈약하거나 사용자가 명시적으로 제외 요청한 표현 — 매치되더라도 강조하지 않음.
// 예) "거듭날 기회를 제공", "차별적 효과를 제공" 같은 상투적 효익 표현,
//     "수치는 2021년의 52억 달러 시장" 처럼 본문 흐름상 강조 가치가 낮은 수치 인용.
const EXCLUDE_MATCH_RE = /(?:거듭날\s*기회|차별적\s*효과|기회를\s*제공|효과를\s*제공)/;
const EXCLUDE_CONTEXT_RE = /수치는\s*$/;

// ---------------------------------------------------------------------------
// 런타임 동적 규칙: 관리자 승인된 제외/추가 문구.
// useHighlightRules() 훅이 로드한 결과를 setRuntimeHighlightRules()로 주입.
// ---------------------------------------------------------------------------
let RUNTIME_EXCLUDES: string[] = [];
let RUNTIME_INCLUDES: string[] = [];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function setRuntimeHighlightRules(
  rules: { kind: "exclude" | "include"; phrase: string }[],
) {
  RUNTIME_EXCLUDES = [];
  RUNTIME_INCLUDES = [];
  for (const r of rules) {
    const p = (r.phrase || "").trim();
    if (!p) continue;
    if (r.kind === "exclude") RUNTIME_EXCLUDES.push(p);
    else RUNTIME_INCLUDES.push(p);
  }
}

function matchesRuntimeExclude(text: string): boolean {
  if (RUNTIME_EXCLUDES.length === 0) return false;
  const norm = text.replace(/\s+/g, "");
  return RUNTIME_EXCLUDES.some((p) => {
    const np = p.replace(/\s+/g, "");
    return np.length > 0 && norm.includes(np);
  });
}

function trimTrailingParticle(s: string): string {
  return s.replace(/[\s]*[은는이가을를의에서와과로으로]+$/u, "").trim();
}

export function collectMatches(text: string): HLMatch[] {
  const all: HLMatch[] = [];
  // 0) 관리자가 승인한 'include' 문구를 강제 매치(공백 유연 매칭)
  for (const phrase of RUNTIME_INCLUDES) {
    const trimmed = phrase.trim();
    if (!trimmed) continue;
    const flexible = trimmed.split(/\s+/).map(escapeRegExp).join("\\s+");
    const re = new RegExp(flexible, "g");
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text)) !== null) {
      if (!mm[0]) { re.lastIndex++; continue; }
      all.push({ start: mm.index, end: mm.index + mm[0].length, type: "solution", text: mm[0] });
    }
  }
  for (const { type, regex } of HL_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      const rawMatched = (m[1] || m[0]).trim();
      // 1) 디스코스 접두어 제거 후 평가 ("결론적으로 본 기술" → "본 기술")
      const stripped = rawMatched.replace(DISCOURSE_PREFIX_RE, "").trim();
      // 2) 일반명사 단독/필러는 제외 ("본 기술", "본 발명", "모델", "구조", "기술 이전" 등)
      if (!stripped || FILLER_RE.test(stripped)) continue;
      if (/(통해\s*개발된\s*만큼\s*기술|본\s*기술|본\s*발명|본\s*특허|농업\s*분야에서\s*본\s*기술)$/.test(rawMatched)) continue;
      // 3) 후행 조사가 그대로 매치된 경우 잘라낸다 ("확보가 상용화" → 잘라도 의미 흐려지면 폐기)
      const matchedText = rawMatched;
      // 매치 본문이 결국 필러로 끝나면 제외
      if (FILLER_RE.test(trimTrailingParticle(matchedText))) continue;
      const offset = m[0].indexOf(m[1] || m[0]);
      const start = m.index + Math.max(0, offset);
      // 4) 명시 제외 문구는 폐기.
      if (EXCLUDE_MATCH_RE.test(matchedText)) continue;
      // 4-b) 런타임 승인된 'exclude' 문구와 겹치면 폐기.
      if (matchesRuntimeExclude(matchedText)) continue;
      // 5) 직전 컨텍스트 기반 제외 ("수치는 ... 52억 달러 시장" 류).
      const preceding = text.slice(Math.max(0, start - 12), start);
      if (EXCLUDE_CONTEXT_RE.test(preceding)) continue;
      all.push({ start, end: start + matchedText.length, type, text: matchedText });
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
  return filtered;
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
      out.push(
        <mark
          key={`hl-${key++}`}
          className={`bg-transparent ${HL_STYLE[m.type]}`}
        >
          {m.text}
        </mark>,
      );
      cursor = m.end;
    }
    if (cursor < text.length) out.push(text.slice(cursor));
  }
  return out;
}