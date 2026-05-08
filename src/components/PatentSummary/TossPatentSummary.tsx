import { useEffect, useRef, useState, useMemo } from "react";
import {
  Sparkles, Share2, Loader2, Lightbulb, TrendingUp, Leaf, Rocket, FileText, Mail,
  QrCode, X, Copy, Check, Heart, ExternalLink, Printer, Link2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PatentSummaryProps as BasePatentSummaryProps } from "./types";
import type { CommercializationDetails } from "./TechnologyCommercializationScore";
import { RelatedPatentsCompact } from "./RelatedPatentsCompact";
import { PdfGenerator } from "./PdfGenerator";
import { PptGenerator } from "./PptGenerator";
import { PrintableContent } from "./PrintableContent";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { annotateWithGlossary } from "@/components/GlossaryTooltip";

interface TossPatentSummaryProps extends BasePatentSummaryProps {
  onKeywordClick?: (keyword: string) => void;
  onScoreReady?: (score: number) => void;
}

const SOFT = "#F2F4F6";
const ACCENT_HEX = "#10B981";

function SectionTitle({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-5">
      {kicker && <p className="text-[13px] font-semibold mb-1.5" style={{ color: ACCENT_HEX }}>{kicker}</p>}
      <h2 className="text-[22px] sm:text-[24px] font-bold text-[#191F28] tracking-[-0.02em] leading-[1.3]">
        {children}
      </h2>
    </div>
  );
}

function SoftCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] p-5 sm:p-6 ${className}`} style={{ background: SOFT }}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#E5E8EB] last:border-0">
      <span className="text-[14px] text-[#8B95A1] font-medium">{label}</span>
      <span className="text-[14px] text-[#191F28] font-semibold text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function PatentTimeline({
  filingDate,
  publicationDate,
  registrationDate,
  hasRegistration,
}: {
  filingDate?: string;
  publicationDate?: string;
  registrationDate?: string;
  hasRegistration: boolean;
}) {
  const steps = [
    { key: "file", label: "출원", date: filingDate, done: !!filingDate, color: "#3B82F6" },
    { key: "pub", label: "공개", date: publicationDate, done: !!publicationDate, color: "#F59E0B" },
    { key: "reg", label: "등록", date: registrationDate, done: hasRegistration, color: ACCENT_HEX },
  ];
  // Elapsed days from filing to registration (or today if pending)
  const parse = (s?: string) => {
    if (!s) return null;
    const m = s.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!m) return null;
    return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  };
  const start = parse(filingDate);
  const end = parse(registrationDate) || parse(publicationDate);
  let elapsed: string | null = null;
  if (start && end) {
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    const years = (days / 365).toFixed(1);
    elapsed = `${years}년 (${days.toLocaleString()}일)`;
  }

  return (
    <div className="px-4 sm:px-5 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold text-[#8B95A1]">출원 · 등록 경과</p>
        {elapsed && (
          <p className="text-[12px] font-semibold text-[#4E5968] tabular-nums">
            소요 <span style={{ color: ACCENT_HEX }}>{elapsed}</span>
          </p>
        )}
      </div>
      <div className="relative">
        {/* base line */}
        <div className="absolute left-[10%] right-[10%] top-[13px] h-[3px] bg-[#E5E8EB] rounded-full" />
        {/* progress gradient line */}
        <div
          className="absolute left-[10%] top-[13px] h-[3px] rounded-full transition-all duration-500"
          style={{
            background: hasRegistration
              ? "linear-gradient(90deg, #3B82F6 0%, #F59E0B 50%, #10B981 100%)"
              : publicationDate
              ? "linear-gradient(90deg, #3B82F6 0%, #F59E0B 100%)"
              : "#3B82F6",
            width: hasRegistration ? "80%" : publicationDate ? "40%" : filingDate ? "0%" : "0%",
          }}
        />
        <div className="relative grid grid-cols-3 gap-2">
          {steps.map((s) => (
            <div key={s.key} className="flex flex-col items-center text-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center border-[2.5px] bg-white shadow-sm transition-all"
                style={{
                  borderColor: s.done ? s.color : "#D1D6DB",
                  background: s.done ? s.color : "#fff",
                  boxShadow: s.done ? `0 0 0 4px ${s.color}1A` : undefined,
                }}
              >
                {s.done && (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <p
                className="mt-2 text-[12.5px] font-bold"
                style={{ color: s.done ? s.color : "#8B95A1" }}
              >
                {s.label}
              </p>
              <p className="text-[11px] text-[#8B95A1] font-medium tabular-nums mt-0.5 min-h-[14px]">
                {s.date || (s.done ? "" : "—")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-semibold text-[#191F28]">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

// ============ 본문 자동 하이라이트 — 다층 패턴 매칭 ============
// 카테고리 → 시각 처리
type HLType = "metric" | "superlative" | "solution" | "problem" | "compare" | "concept" | "quote" | "tech";

const HL_STYLE: Record<HLType, string> = {
  metric:      "font-bold text-[#0B7C5C] bg-[#10B9811F] px-1 rounded-[4px] tabular-nums", // 수치+단위
  compare:     "font-bold text-[#0B7C5C] bg-[#10B98114] px-1 rounded-[4px]",               // N배/대비/이상 향상
  superlative: "font-bold text-[#B45309] bg-[#FEF3C7] px-1 rounded-[4px]",                 // 최초/유일/독보적
  solution:    "font-semibold text-[#047857] underline decoration-[#10B98166] decoration-2 underline-offset-[3px]", // 해결/개선/극복/달성
  problem:     "font-semibold text-[#B91C1C]",                                              // 문제/한계/어려움
  concept:     "font-semibold text-[#191F28]",                                              // 핵심 개념(명사+기술/공법…)
  tech:        "font-semibold text-[#1D4ED8]",                                              // AI/IoT/스마트 등 기술 용어
  quote:       "font-semibold text-[#191F28] bg-[#F2F4F6] px-1 rounded-[4px]",              // 「…」, '…' 인용
};

// 패턴 — 우선순위 순서대로 적용. 비-겹침 매칭 보장을 위해 한 번에 위치를 모아 선점.
const HL_PATTERNS: { type: HLType; regex: RegExp }[] = [
  // 1) 인용 부호 안의 핵심 용어
  { type: "quote",       regex: /([「『"][^「『"\n]{1,30}[」』"])/g },
  // 2) 비교/향상 표현 (수치 + 향상/감소)
  { type: "compare",     regex: /(\d+(?:\.\d+)?\s?(?:배|%|퍼센트)\s*(?:이상|이하)?\s*(?:향상|증가|개선|증대|상승|단축|감소|절감|저감))/g },
  // 3) 단순 수치+단위
  { type: "metric",      regex: /(\d+(?:\.\d+)?(?:\s?(?:%|배|개|건|회|차|년|개월|월|일|주|시간|분|초|kg|g|mg|mm|cm|m|km|ml|L|°C|℃|kW|W|kWh|Hz|MHz|GHz|원|만원|억원|건당|점)))/g },
  // 4) 최상급/유일성 표현
  { type: "superlative", regex: /(세계\s*최초|국내\s*최초|업계\s*최초|세계\s*최고|국내\s*최고|세계\s*유일|국내\s*유일|독보적인?|차별화된|혁신적인?|획기적인?|최고\s*수준|최상위|유일한|독점적인?)/g },
  // 5) 해결/개선/달성 동사구
  { type: "solution",    regex: /([가-힣A-Za-z]{2,12}을?를?\s*(?:해결|극복|개선|향상|증대|확보|달성|실현|가능하게|가능케)(?:함|한다|하였다|시켰다|시킨다|할 수 있다|할 수 있음)?)/g },
  // 6) 문제/한계 표현
  { type: "problem",     regex: /([가-힣A-Za-z]{2,12}(?:의)?\s*(?:문제점?|한계점?|어려움|단점|취약점|부족|불편|손실|오류|결함)|기존\s*기술의?\s*[가-힣]{0,10}한계|종래\s*기술|종래\s*방식)/g },
  // 7) 핵심 개념 명사구 (… 기술/시스템/공법/방식/장치/모듈/메커니즘/알고리즘/플랫폼/구조)
  { type: "concept",     regex: /([가-힣A-Za-z]{2,15}(?:\s*[가-힣A-Za-z]{1,10}){0,2}\s*(?:기술|시스템|공법|방식|장치|모듈|메커니즘|알고리즘|플랫폼|구조|구성|프로세스|솔루션))/g },
  // 8) 기술 키워드 (영문 약어/스마트/지능형 등)
  { type: "tech",        regex: /(AI|IoT|ICT|GPS|RFID|NFC|5G|API|ML|DL|CNN|RNN|LLM|NGS|PCR|CRISPR|블록체인|빅데이터|클라우드|딥러닝|머신러닝|인공지능|자율주행|자동화|지능형|스마트(?:팜|시티|폰|센서)?)/g },
];

interface HLMatch { start: number; end: number; type: HLType; text: string; }

function collectMatches(text: string): HLMatch[] {
  const all: HLMatch[] = [];
  for (const { type, regex } of HL_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      all.push({ start: m.index, end: m.index + m[0].length, type, text: m[0] });
    }
  }
  // 정렬 후 겹침 제거 — 더 길고 우선순위 높은(앞 카테고리) 매칭 우선
  all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const filtered: HLMatch[] = [];
  let cursor = 0;
  for (const m of all) {
    if (m.start < cursor) continue; // 겹침 스킵
    filtered.push(m);
    cursor = m.end;
  }
  return filtered;
}

function highlightImportant(nodes: React.ReactNode[]): React.ReactNode[] {
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

function ScoreRow({ label, value, color, reason }: { label: string; value: number; color: string; reason?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[14px] font-semibold text-[#191F28]">{label}</span>
        <span className="text-[16px] font-bold tabular-nums" style={{ color }}>
          {value}<span className="text-[12px] text-[#8B95A1] ml-0.5">점</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#E5E8EB] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      {reason && (
        <p className="mt-2.5 text-[13px] leading-[1.7] text-[#4E5968]">{renderBold(reason)}</p>
      )}
    </div>
  );
}

type KeywordCategory = "function" | "industry" | "material" | "tech" | "general";

const CATEGORY_STYLE: Record<KeywordCategory, { bg: string; text: string; border: string; label: string }> = {
  function: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "기능" },
  industry: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "활용산업" },
  material: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", label: "소재" },
  tech:     { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF", label: "기술" },
  general:  { bg: "#FFFFFF", text: "#4E5968", border: "#E5E8EB", label: "기타" },
};

// 카테고리 분류 사전 (부분일치 + 정규식)
function classifyKeyword(word: string): KeywordCategory {
  const w = word.toLowerCase();
  // 활용산업/분야
  if (/(농업|축산|수산|임업|원예|화훼|식품|제약|의약|의료|바이오|헬스|에너지|환경|건설|건축|자동차|항공|조선|반도체|전자|화학|섬유|패션|물류|유통|교육|관광|금융|미용|화장품|가공|제조|산업|시장|소비자|유아|아동|노인|가정|외식|급식|병원|학교|공장|농장|농가|축사|온실|비닐하우스|스마트팜|밭|논|하우스)/.test(word)) return "industry";
  // 소재/원료
  if (/(소재|원료|재료|성분|물질|추출물|분말|입자|섬유|금속|합금|폴리머|수지|세라믹|실리콘|탄소|나노|효소|미생물|균주|배지|용액|용매|용제|첨가제|보조제|식물|곡물|과일|채소|허브|꽃|뿌리|잎|줄기|씨앗|종자|종균|콩|쌀|밀|보리|옥수수|고구마|감자|토마토|딸기|버섯|약초|한약|생약|단백질|지방|당류|비타민|미네랄)/.test(word)) return "material";
  // 기술/장치
  if (/(ai|인공지능|머신러닝|딥러닝|iot|블록체인|빅데이터|클라우드|로봇|자동화|자율주행|센서|카메라|드론|gps|rfid|nfc|5g|알고리즘|네트워크|플랫폼|소프트웨어|하드웨어|모듈|디바이스|controller|제어기|구동부|모터|배터리|회로|기판|디스플레이)/.test(w)) return "tech";
  // 기능/효과/공정
  if (/(분석|측정|감지|판별|판정|진단|검출|예측|인식|식별|추적|모니터링|제어|조절|관리|운영|운용|처리|가공|살포|분사|분무|건조|냉각|가열|살균|멸균|발효|숙성|혼합|배합|성형|코팅|포장|저장|보관|운반|이송|선별|수확|파종|이식|관수|급수|시비|방제|제초|예찰|예방|보호|개선|향상|증대|증가|감소|절감|절약|최적화|효율|품질|안전|편리|간편|신속|정확)/.test(word)) return "function";
  return "general";
}

function KeywordChip({
  children, onClick, category = "general",
}: { children: React.ReactNode; onClick?: () => void; category?: KeywordCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {children}
    </button>
  );
}

interface MdSection {
  title: string;
  paragraphs: string[];
  footnotes?: { num: number; text: string }[];
}
function parseSections(md: string): MdSection[] {
  if (!md) return [];
  const lines = md.split("\n");
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  let buf = "";
  let inSourcesBlock = false; // ### 출처 진입 후 footnote 수집 모드
  const flush = () => {
    if (cur && buf.trim()) cur.paragraphs.push(buf.trim());
    buf = "";
  };
  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, "");
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      flush();
      if (cur) sections.push(cur);
      cur = { title: h2[1].trim(), paragraphs: [], footnotes: [] };
      inSourcesBlock = false;
      continue;
    }
    // ### 출처 / 참고문헌 등 헤더 — footnote 수집 모드 진입
    const h3 = line.match(/^#{3,6}\s+(.+?)\s*$/);
    if (h3) {
      flush();
      inSourcesBlock = /출처|참고\s*문헌|references?|sources?/i.test(h3[1]);
      continue;
    }
    // [^N]: 본문 어디서든 footnote 정의로 인식
    const fn = line.match(/^\s*\[\^(\d+)\]:\s*(.+?)\s*$/);
    if (fn && cur) {
      cur.footnotes!.push({ num: parseInt(fn[1], 10), text: fn[2].trim() });
      continue;
    }
    if (line.trim() === "") { flush(); continue; }
    // 출처 블록 내 일반 라인 — "1. 기관명, ..." 또는 "- 기관명" 형식도 footnote로 흡수
    if (inSourcesBlock && cur) {
      const numbered = line.match(/^\s*(?:[-•]|\d+\.)\s*(.+?)\s*$/);
      const txt = (numbered ? numbered[1] : line).trim();
      if (txt) {
        const next = (cur.footnotes!.length || 0) + 1;
        cur.footnotes!.push({ num: next, text: txt });
      }
      continue;
    }
    const cleaned = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/[`_]/g, "").trim();
    buf += (buf ? " " : "") + cleaned;
  }
  flush();
  if (cur) sections.push(cur);
  return sections.filter(s =>
    !/특허\s*기본\s*정보/i.test(s.title) &&
    (s.paragraphs.length > 0 || (s.footnotes && s.footnotes.length > 0))
  );
}

// 본문 [^1] 인라인 마커를 superscript 노드로 변환
function renderWithFootnoteRefs(text: string): React.ReactNode[] {
  const parts = text.split(/(\[\^\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[\^(\d+)\]$/);
    if (m) {
      return (
        <sup
          key={`fn-${i}`}
          className="ml-0.5 text-[10px] font-bold align-super"
          style={{ color: "#10B981" }}
        >
          {m[1]}
        </sup>
      );
    }
    return p;
  });
}

function sectionMeta(title: string): { kicker: string; heading: string; Icon: typeof Lightbulb } {
  if (/기술\s*분야/.test(title)) return { kicker: "기술 분야", heading: "어떤 기술인가요?", Icon: Lightbulb };
  if (/발명|요약|특징/.test(title)) return { kicker: "발명 요약", heading: "무엇을 해결하나요?", Icon: FileText };
  if (/시장|동향/.test(title)) return { kicker: "시장 동향", heading: "시장은 어떻게 움직이나요?", Icon: TrendingUp };
  if (/농산업|활용|응용/.test(title)) return { kicker: "농산업 활용", heading: "어디에 쓸 수 있나요?", Icon: Leaf };
  if (/상용화|사업화|전망|성숙/.test(title)) return { kicker: "상용화 전망", heading: "사업화 가능성은?", Icon: Rocket };
  return { kicker: title, heading: title, Icon: FileText };
}

function extractKeywords(md: string, max = 8): string[] {
  if (!md) return [];
  // 사전 기반 추출: 의미 있는 명사(기능/소재/산업/기술/제품)만 키워드로 채택.
  // 동사형(활용하여, 사용함으로써 등), 형용사/부사형, 일반 단편은 모두 배제.
  const sections = parseSections(md);
  const focusText = sections
    .filter((s) => /활용|응용|산업|분야|발명|요약|특징|기능|용도|제품/.test(s.title))
    .map((s) => s.paragraphs.join(" "))
    .join(" ");
  const source = focusText || md;
  const text = source.replace(/[#*_`>\[\]\(\)]/g, " ");

  // 카테고리별 표제어 사전 — 부분일치(text.includes)로 검색
  const DICT: { word: string; cat: KeywordCategory }[] = [
    // ─ 활용 산업/분야
    ...["농업","축산","수산","임업","원예","화훼","식품","제약","의약","의료","바이오","헬스케어",
        "에너지","환경","건설","건축","자동차","항공","조선","반도체","전자","화학","섬유","유통",
        "교육","관광","금융","화장품","가공식품","제조업","외식","급식","스마트팜","온실","비닐하우스",
        "농가","농장","축사","논","밭","과수원","육종","종자산업","종묘"]
      .map((word) => ({ word, cat: "industry" as const })),

    // ─ 소재/원료/생물
    ...["소재","원료","성분","추출물","분말","입자","섬유","금속","합금","폴리머","수지","세라믹",
        "실리콘","탄소","나노입자","효소","미생물","균주","배지","용액","용매","첨가제","보조제",
        "단백질","지방","당류","비타민","미네랄","안토시아닌","폴리페놀","플라보노이드","항산화물질",
        "곡물","과일","채소","허브","씨앗","종자","종균","쌀","밀","보리","옥수수","고구마","감자",
        "토마토","딸기","버섯","약초","한약","생약","콩","배수체","반수체","DNA","RNA","유전자"]
      .map((word) => ({ word, cat: "material" as const })),

    // ─ 기술/장치
    ...["인공지능","머신러닝","딥러닝","빅데이터","블록체인","클라우드","로봇","자동화","자율주행",
        "센서","카메라","드론","알고리즘","플랫폼","소프트웨어","하드웨어","모듈","제어기","구동부",
        "모터","배터리","회로","디스플레이","바이오마커","마커","유전자가위","CRISPR","PCR","NGS",
        "스마트","IoT","5G","GPS","RFID"]
      .map((word) => ({ word, cat: "tech" as const })),

    // ─ 기능/공정/효과
    ...["분석","측정","감지","판별","판정","진단","검출","예측","인식","식별","추적","모니터링",
        "제어","조절","관리","처리","가공","살포","분사","건조","냉각","가열","살균","멸균",
        "발효","숙성","혼합","배합","성형","코팅","포장","저장","운반","선별","수확","파종",
        "이식","관수","급수","시비","방제","제초","예방","개선","향상","증대","절감","최적화",
        "효율","품질","안전성","편의성","신속성","정확도"]
      .map((word) => ({ word, cat: "function" as const })),
  ];

  // 동사형/형용사형 차단(혹시 사전 단어와 부분일치 후 어미가 붙은 형태가 등장해도 사전 단어는 그대로 카운트)
  const freq = new Map<string, KeywordCategory>();
  const counts = new Map<string, number>();
  for (const { word, cat } of DICT) {
    const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = text.match(re);
    if (matches && matches.length > 0) {
      freq.set(word, cat);
      counts.set(word, matches.length);
    }
  }

  // 너무 짧은 단어가 다른 단어의 부분 문자열인 경우 제거(예: "콩" vs "콩나물")
  const words = [...counts.keys()].sort((a, b) => b.length - a.length);
  const accepted: string[] = [];
  for (const w of words) {
    if (accepted.some((a) => a.includes(w) && a !== w)) continue;
    accepted.push(w);
  }

  return accepted
    .sort((a, b) => (counts.get(b)! - counts.get(a)!) || (b.length - a.length))
    .slice(0, max);
}

export function TossPatentSummary({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
  onRelatedPatentClick,
  onKeywordClick,
  onScoreReady,
  featureFlags = { pdfEnabled: true, pptEnabled: true },
}: TossPatentSummaryProps) {
  const { settings } = useSiteSettings();
  const { isFavorite, toggleFavorite } = useFavoritePatents();
  const patentIsFavorite = patentNumber ? isFavorite(patentNumber) : false;

  const [score, setScore] = useState<number | null>(null);
  const [details, setDetails] = useState<CommercializationDetails | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const favoritesEnabled = settings.feature_favorites !== "false";
  const competitorAnalysisEnabled = settings.feature_competitor_analysis !== "false";
  const glossaryEnabled = settings.feature_glossary !== "false";
  const annotate = (text: string) => (glossaryEnabled ? annotateWithGlossary(text) : text);

  const pdfLayoutConfig = useMemo(() => {
    try { return settings.pdf_layout_config ? JSON.parse(settings.pdf_layout_config) : undefined; } catch { return undefined; }
  }, [settings.pdf_layout_config]);

  const printSections = useMemo(() => {
    const defaults = { patentInfo: true, commercialization: true, aiSummary: true, trl: true, claims: false, relatedPatents: false, disclaimer: true };
    try { return settings.print_sections ? { ...defaults, ...JSON.parse(settings.print_sections) } : defaults; } catch { return defaults; }
  }, [settings.print_sections]);

  // 사업화 점수 호출
  useEffect(() => {
    const run = async () => {
      if (!patentData || !patentNumber || isStreaming) return;
      setScoreLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-commercialization`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ patentNumber, patentData }),
          }
        );
        const json = await res.json();
        if (json.success) {
          setScore(json.score);
          setDetails(json.details);
          onScoreReady?.(json.score);
        }
      } catch (e) {
        console.error("Commercialization analysis error:", e);
      } finally {
        setScoreLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patentData, patentNumber, isStreaming]);

  const trl = details?.trl ?? null;
  const trlColor = trl == null ? "#9CA3AF" : trl <= 3 ? "#EF4444" : trl <= 6 ? "#F59E0B" : ACCENT_HEX;
  const trlStage = trl == null ? "-" : trl <= 3 ? "기초연구" : trl <= 6 ? "개발/실증" : "상용화";

  const title = patentData?.titleKo || patentData?.title || `특허 ${patentNumber}`;
  const sections = useMemo(() => parseSections(content), [content]);
  const keywords = useMemo(() => extractKeywords(content, 8), [content]);

  const drawings: string[] = useMemo(() => {
    const list: string[] = [];
    if (patentData?.representativeImage) list.push(patentData.representativeImage);
    if (patentData?.images) for (const u of patentData.images) if (!list.includes(u)) list.push(u);
    return list.slice(0, 4);
  }, [patentData]);
  const proxify = (u: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(u)}`;

  const scoreSummary = score == null ? "분석 중" : score >= 80 ? "높은 편" : score >= 65 ? "보통 수준" : "낮은 편";

  // 공유 URL: 항상 published origin 사용 (수신자 접근성)
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const publishedOrigin = "https://atipsum.lovable.app";
    const currentOrigin = window.location.origin;
    const baseOrigin = currentOrigin.includes("-preview--") || currentOrigin.includes("lovableproject.com")
      ? publishedOrigin
      : currentOrigin;
    return `${baseOrigin}/?patent=${encodeURIComponent(patentNumber)}`;
  }, [patentNumber]);

  const shareTitle = `[특허 요약] ${title}`;
  const shareBody =
    `${title}\n` +
    `· 특허번호: ${patentNumber}\n` +
    (score != null ? `· 사업화 점수: ${score}/100 (${scoreSummary})\n` : "") +
    (trl != null ? `· TRL: ${trl}/9 (${trlStage})\n` : "") +
    `\n전체 요약서 보기:\n${shareUrl}\n`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareBody)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("링크가 복사되었습니다");
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handlePrint = () => window.print();

  return (
    <div className="text-[#191F28]" style={{ fontFamily: "'Pretendard','Inter',sans-serif" }}>
      {/* Printable (Hidden) */}
      <PrintableContent
        ref={printRef}
        content={content}
        patentNumber={patentNumber}
        patentData={patentData}
        printSections={printSections}
      />

      {/* 액션바: 토스 스타일 미니멀, 기능은 모두 유지 */}
      {!isStreaming && content && (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6 print:hidden">
          <div className="flex items-center gap-1.5">
            <a href="https://www.nati.or.kr/login.do?selPrgId=xfr_apply" target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 text-[12.5px] h-9 rounded-full bg-[#191F28] text-white hover:bg-[#333D4B] font-semibold shadow-sm">
                <ExternalLink className="w-3.5 h-3.5" />
                기술이전 신청
              </Button>
            </a>
            {patentData?.applicationNumber && (
              <a href={`https://www.kipris.or.kr/khome/detail/newWindow.do?right=kpat&applno=${patentData.applicationNumber}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-[12.5px] h-9 rounded-full font-medium border-[#E5E8EB] text-[#4E5968]">
                  <FileText className="w-3.5 h-3.5" />
                  특허상세
                </Button>
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]">
              <Printer className="w-3.5 h-3.5" /> 인쇄
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)} className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]">
              <Share2 className="w-3.5 h-3.5" /> 공유
            </Button>
            {favoritesEnabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!patentData) return;
                  toggleFavorite({
                    patentNumber,
                    patentData,
                    commercializationScore: score,
                    commercializationDetails: details,
                    summary: content,
                    addedAt: new Date().toISOString(),
                  });
                  toast.success(patentIsFavorite ? "관심특허에서 제거되었습니다" : "관심특허에 담았습니다");
                }}
                className={`gap-1 text-[12px] h-9 px-2.5 rounded-full ${patentIsFavorite ? "text-[#EF4444]" : "text-[#4E5968]"}`}
              >
                <Heart className={`w-3.5 h-3.5 ${patentIsFavorite ? "fill-current" : ""}`} />
                {patentIsFavorite ? "담김" : "담기"}
              </Button>
            )}
            {featureFlags.pdfEnabled && (
              <PdfGenerator
                content={content}
                patentNumber={patentNumber}
                patentData={patentData}
                printRef={printRef}
                commercializationDetails={details}
                commercializationScore={score}
                layoutConfig={pdfLayoutConfig}
              />
            )}
            {featureFlags.pptEnabled && (
              <PptGenerator
                content={content}
                patentNumber={patentNumber}
                patentData={patentData}
                commercializationDetails={details}
                commercializationScore={score}
              />
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[24px] border border-[#F2F4F6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="max-w-[680px] mx-auto px-5 sm:px-7 pb-12">
          {/* HERO */}
          <section className="pt-9 pb-5">
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.3] tracking-[-0.02em] mb-2 text-[#191F28]">
              {title}
            </h1>
            <p className="text-[14px] text-[#8B95A1] font-medium mb-6 tabular-nums">
              {patentData?.searchType === 'application' ? '출원번호' : '등록번호'} · {patentNumber}
            </p>
          </section>

          {/* 한눈에 보는 기본 정보 — 최상단(타이틀 바로 아래) */}
          {patentData && (
            <section className="mb-6">
              <SectionTitle kicker="특허 정보">한눈에 보는 기본 정보</SectionTitle>
              <SoftCard className="!p-2">
                <div className="bg-white rounded-[16px] px-4 sm:px-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {patentData.applicationNumber && <Row label="출원번호" value={patentData.applicationNumber} />}
                  {patentData.filingDate && <Row label="출원일자" value={patentData.filingDate} />}
                  {patentData.registrationNumber && <Row label="등록번호" value={patentData.registrationNumber} />}
                  {patentData.registrationDate
                    ? <Row label="등록일자" value={patentData.registrationDate} />
                    : (patentData.publicationDate && <Row label="공개일자" value={patentData.publicationDate} />)}
                  {patentData.assignee && <Row label="출원인" value={patentData.assignee} />}
                  {patentData.inventors?.length ? (
                    <Row label="발명자" value={patentData.inventors.length >= 5 ? `${patentData.inventors.slice(0, 4).join(", ")} 등 ${patentData.inventors.length}명` : patentData.inventors.join(", ")} />
                  ) : null}
                  {patentData.classifications?.length ? (
                    <Row label="IPC 분류" value={patentData.classifications.slice(0, 3).join(", ")} />
                  ) : null}
                </div>
                {(patentData.filingDate || patentData.publicationDate || patentData.registrationDate || patentData.registrationNumber) && (
                  <div className="bg-white rounded-[16px] mt-2">
                    <PatentTimeline
                      filingDate={patentData.filingDate}
                      publicationDate={patentData.publicationDate}
                      registrationDate={patentData.registrationDate}
                      hasRegistration={!!(patentData.registrationDate || patentData.registrationNumber)}
                    />
                  </div>
                )}
              </SoftCard>
            </section>
          )}

          {/* 종합점수 + 세부점수 + TRL 통합 카드 */}
          <section className="mb-8">
            <SectionTitle kicker="AI 평가">사업화 점수 & 기술 성숙도</SectionTitle>
            <SoftCard>
              {/* 종합점수 헤더 */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E5E8EB]">
                <div className="min-w-0">
                  <p className="text-[12px] text-[#8B95A1] font-semibold mb-1">종합 사업화 점수</p>
                  {scoreLoading || score == null ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT_HEX }} />
                      <span className="text-[13px] text-[#8B95A1] font-semibold">분석 중...</span>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#4E5968] font-medium">
                      상용화 잠재력 <span className="font-bold text-[#191F28]">{scoreSummary}</span>
                    </p>
                  )}
                </div>
                {score != null && (
                  <div className="flex items-end gap-1 shrink-0">
                    <span className="text-[44px] sm:text-[52px] font-bold leading-none tabular-nums tracking-tight" style={{ color: ACCENT_HEX }}>
                      {score}
                    </span>
                    <span className="text-[14px] text-[#8B95A1] font-semibold mb-1.5">/100</span>
                  </div>
                )}
              </div>

              {/* 세부 점수 — 컴팩트 그리드 */}
              {details && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 py-5 border-b border-[#E5E8EB]">
                  <ScoreRow label="기술성" value={details.technologyScore} color={ACCENT_HEX} reason={details.technologyReason} />
                  <ScoreRow label="시장성" value={details.marketScore} color="#3B82F6" reason={details.marketReason} />
                  <ScoreRow label="사업성" value={details.businessScore} color="#F59E0B" reason={details.businessReason} />
                </div>
              )}

              {/* TRL — 같은 카드 내 통합 */}
              {details && (
                <div className="pt-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] text-[#8B95A1] font-semibold">기술 성숙도 (TRL)</span>
                      <span className="text-[18px] font-bold tabular-nums" style={{ color: trlColor }}>{trl ?? "-"}</span>
                      <span className="text-[#8B95A1] text-[12px] font-semibold">/ 9</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: trlColor }}>
                      {trlStage}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 9 }).map((_, i) => {
                      const lvl = i + 1;
                      const active = trl != null && lvl <= trl;
                      const c = lvl <= 3 ? "#EF4444" : lvl <= 6 ? "#F59E0B" : ACCENT_HEX;
                      return <div key={i} className="flex-1 h-1.5 rounded-full" style={{ background: active ? c : "#E5E8EB" }} />;
                    })}
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-[#8B95A1] font-medium">
                    <span>1 · 기초</span>
                    <span>5 · 실증</span>
                    <span>9 · 상용</span>
                  </div>
                  {details.trlReason && (
                    <p className="mt-3 text-[12.5px] leading-[1.7] text-[#4E5968]">{renderBold(details.trlReason)}</p>
                  )}
                </div>
              )}
            </SoftCard>
          </section>

          {/* 키워드 */}
          {keywords.length > 0 && (
            <section className="mb-8">
              <SectionTitle kicker="핵심 키워드">핵심 기능 · 활용 가능 산업</SectionTitle>
              <SoftCard className="!p-4">
                {(() => {
                  const grouped = keywords.reduce<Record<KeywordCategory, string[]>>((acc, k) => {
                    const c = classifyKeyword(k);
                    (acc[c] ||= []).push(k);
                    return acc;
                  }, { function: [], industry: [], material: [], tech: [], general: [] });
                  const order: KeywordCategory[] = ["function", "industry", "tech", "material", "general"];
                  const usedCats = order.filter((c) => grouped[c]?.length);
                  return (
                    <div>
                      {/* 범례 */}
                      {usedCats.length > 1 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 pb-3 border-b border-[#E5E8EB]">
                          {usedCats.map((c) => {
                            const s = CATEGORY_STYLE[c];
                            return (
                              <div key={c} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ background: s.text }} />
                                <span className="text-[11.5px] font-semibold" style={{ color: s.text }}>{s.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {usedCats.flatMap((c) =>
                          grouped[c].map((k) => (
                            <KeywordChip key={k} category={c} onClick={() => onKeywordClick?.(k)}>{k}</KeywordChip>
                          )),
                        )}
                      </div>
                    </div>
                  );
                })()}
              </SoftCard>
            </section>
          )}

          {/* 도면 */}
          {drawings.length > 0 && (
            <section className="mb-10">
              <SectionTitle kicker="특허 도면">한눈에 보는 기술 구성</SectionTitle>
              <SoftCard className="!p-3">
                <div className={drawings.length === 1 ? "flex justify-center" : "grid grid-cols-2 gap-2"}>
                  {drawings.map((url, i) => (
                    <div key={i} className="bg-white rounded-[14px] p-3 flex flex-col items-center">
                      <img
                        src={proxify(url)}
                        alt={`도면 ${i + 1}`}
                        className="w-full h-auto max-h-[280px] object-contain"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                        }}
                      />
                      <p className="text-[12px] text-[#8B95A1] mt-2 font-medium">
                        {i === 0 && patentData?.representativeImage ? "【대표 도면】" : `【도면 ${i + 1}】`}
                      </p>
                    </div>
                  ))}
                </div>
              </SoftCard>
            </section>
          )}

          {/* AI 요약 본문 */}
          {isStreaming && sections.length === 0 ? (
            <section className="mb-10">
              <div className="flex items-center gap-2 text-[#8B95A1]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[14px]">AI가 요약서를 생성 중입니다...</span>
              </div>
            </section>
          ) : (
            sections.map((sec, idx) => {
              const { kicker, heading } = sectionMeta(sec.title);
              return (
                <section key={idx} className="mb-10">
                  <SectionTitle kicker={kicker}>{heading}</SectionTitle>
                  <div className="space-y-4">
                    {sec.paragraphs.map((p, i) => {
                      // 1) [^N] 인라인 마커를 먼저 분리하여 superscript 노드로 변환
                      const refParts = p.split(/(\[\^\d+\])/g);
                      const processed: React.ReactNode[] = [];
                      refParts.forEach((part, j) => {
                        const m = part.match(/^\[\^(\d+)\]$/);
                        if (m) {
                          processed.push(
                            <sup
                              key={`fn-${i}-${j}`}
                              className="ml-[1px] mr-[1px] text-[10px] font-bold align-super"
                              style={{ color: "#10B981" }}
                            >
                              {m[1]}
                            </sup>,
                          );
                        } else if (part) {
                          // 2) 일반 텍스트 부분만 용어집/하이라이트 적용
                          const annotated = annotate(part);
                          const nodes = Array.isArray(annotated) ? annotated : [annotated];
                          processed.push(...highlightImportant(nodes as React.ReactNode[]));
                        }
                      });
                      return (
                        <p key={i} className="text-[15.5px] leading-[1.78] text-[#4E5968]">
                          {processed}
                        </p>
                      );
                    })}
                  </div>
                  {/* 출처 (각주) — 시장동향 등 출처가 있는 섹션 */}
                  {sec.footnotes && sec.footnotes.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[#E5E8EB]">
                      <p className="text-[12px] font-bold text-[#8B95A1] mb-2">출처</p>
                      <ol className="space-y-1.5">
                        {sec.footnotes.map((fn) => (
                          <li
                            key={fn.num}
                            className="text-[12.5px] leading-[1.6] text-[#4E5968] flex gap-1.5"
                          >
                            <span className="font-bold tabular-nums shrink-0" style={{ color: "#10B981" }}>
                              {fn.num}.
                            </span>
                            <span>{fn.text}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </section>
              );
            })
          )}

          {/* AI 종합 의견 */}
          {details?.analysis && (
            <section className="mb-10">
              <div className="rounded-[20px] p-6" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 100%)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" style={{ color: ACCENT_HEX }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: ACCENT_HEX }}>AI 종합 분석</p>
                </div>
                <p className="text-[15px] leading-[1.75] text-[#191F28] font-medium">
                  {details.analysis}
                </p>
              </div>
            </section>
          )}

          {/* 관련 특허 — 기능·특징이 유사한 특허 */}
          {patentData && (
            <section className="mb-10">
              <SectionTitle kicker="관련 특허"><span className="inline-flex items-center gap-2"><Link2 className="w-5 h-5" style={{ color: ACCENT_HEX }} />기능·특징이 유사한 특허</span></SectionTitle>
              <SoftCard className="!p-3">
                <RelatedPatentsCompact patentData={patentData} onPatentClick={onRelatedPatentClick} />
              </SoftCard>
            </section>
          )}

          {/* 액션 버튼 */}
          {!isStreaming && content && (
            <section className="mb-2">
              <button
                onClick={() => setShareOpen(true)}
                className="w-full h-14 rounded-[16px] text-[16px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
                style={{ background: ACCENT_HEX }}
              >
                <Share2 className="w-[18px] h-[18px]" />
                이메일·QR로 전송하기
              </button>
            </section>
          )}

          <p className="text-[12px] text-[#8B95A1] text-center leading-relaxed mt-8">
            ※ 본 분석은 특허명세서를 바탕으로 실시하여<br />실제 연구 및 개발 단계와는 상이할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 공유 모달 */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 print:hidden"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full sm:max-w-[420px] bg-white rounded-t-[24px] sm:rounded-[24px] p-6 shadow-2xl animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-bold text-[#191F28]">요약서 전송하기</h3>
              <button
                onClick={() => setShareOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]"
                aria-label="닫기"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>

            <div className="rounded-[16px] bg-[#F2F4F6] p-5 flex flex-col items-center mb-4">
              <p className="text-[13px] font-semibold text-[#4E5968] mb-3 flex items-center gap-1.5">
                <QrCode className="w-4 h-4" /> 휴대폰으로 스캔하기
              </p>
              <div className="bg-white p-3 rounded-[12px]">
                <QRCodeSVG value={shareUrl} size={168} level="M" />
              </div>
              <p className="text-[12px] text-[#8B95A1] mt-3 text-center leading-relaxed">
                카메라 앱으로 QR을 스캔하면<br />이 요약서가 바로 열려요
              </p>
            </div>

            <a
              href={mailtoHref}
              className="w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-bold text-white mb-2"
              style={{ background: ACCENT_HEX }}
            >
              <Mail className="w-[18px] h-[18px]" />
              이메일로 보내기
            </a>

            <button
              onClick={copyLink}
              className="w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-bold text-[#191F28] bg-[#F2F4F6] hover:bg-[#E5E8EB] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-[18px] h-[18px]" style={{ color: ACCENT_HEX }} />
                  <span style={{ color: ACCENT_HEX }}>링크 복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-[18px] h-[18px]" />
                  링크 복사
                </>
              )}
            </button>

            <p className="text-[11px] text-[#8B95A1] text-center mt-4 leading-relaxed">
              ※ 이메일 버튼은 기기의 메일 앱이 열리며,<br />수신자·내용을 확인 후 발송할 수 있어요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}