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
  { type: "metric",      regex: /(\d+(?:\.\d+)?(?:\s?(?:%|%p|배|건|개월|kg|g|mg|t|톤|mm|cm|km|ml|L|°C|℃|kW|kWh|Hz|MHz|GHz|만원|억원|조원|건당|점|명|곳|종)))/g },
  { type: "superlative", regex: /(세계\s*최초|국내\s*최초|업계\s*최초|세계\s*최고|국내\s*최고|세계\s*유일|국내\s*유일|독보적인?|차별화된|혁신적인?|획기적인?|최고\s*수준|최상위|유일한|독점적인?|핵심\s*관건|핵심\s*요인|핵심\s*기술|원천\s*기술|진입\s*장벽)/g },
  { type: "concept",     regex: /((?:인공지능|AI|객체\s*탐지|영상\s*분석|무인\s*비행장치|드론|열화상|초분광|근적외선|라이다|LiDAR|스마트\s*방제|유해\s*생물\s*모니터링|병해충\s*예찰|농업용\s*드론|스마트\s*농업|재난\s*안전)(?:\s*(?:기반|활용|결합|탐지|분석|제어|관리|시장|시스템|솔루션|장치|기술|분야|모듈))?)/g },
  { type: "solution",    regex: /([가-힣A-Za-z0-9()·\s]{2,28}(?:자동\s*탐지|원격\s*탐색|실시간\s*분석|위치\s*파악|경로\s*자동\s*생성|다각도\s*영상\s*촬영|피해\s*예방|안전\s*확보|방제\s*계획\s*수립))/g },
  { type: "solution",    regex: /([가-힣A-Za-z0-9()·\s]{2,24}(?:을|를)\s*(?:조기\s*탐지|자동\s*탐지|원격\s*탐색|실시간\s*분석|정확하게\s*파악|신속하게\s*공유|효율적으로\s*방제|획기적으로\s*개선|예방|확보|최적화|강화|극대화))/g },
  { type: "problem",     regex: /(?:^|[\s,.;:()「『"])([가-힣]{2,8}(?:의)?\s*(?:문제점?|한계점?|어려움|단점|취약점|결함|리스크))/g },
  { type: "solution",    regex: /(?:^|[\s,.;:()「『"])([가-힣]{2,8}(?:을|를|이|가)\s*(?:해결|극복|개선|달성|확보|구현|실현|돌파|상용화|국산화|대체|강화|향상|극대화|최적화|증대|확대|단축|절감))/g },
  { type: "solution",    regex: /([가-힣]{2,10}(?:화|성)된\s*(?:기술|시스템|공법|방식|구조|솔루션))/g },
];

interface HLMatch { start: number; end: number; type: HLType; text: string; }

export function collectMatches(text: string): HLMatch[] {
  const all: HLMatch[] = [];
  for (const { type, regex } of HL_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      const matchedText = (m[1] || m[0]).trim();
      if (!matchedText || /(통해\s*개발된\s*만큼\s*기술|본\s*기술|농업\s*분야에서\s*본\s*기술)$/.test(matchedText)) continue;
      const offset = m[0].indexOf(m[1] || m[0]);
      const start = m.index + Math.max(0, offset);
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