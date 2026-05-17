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
import { IndustryImageGallery } from "./IndustryImageGallery";
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
type HLType = "metric" | "superlative" | "solution" | "problem" | "compare" | "concept" | "quote";

const HL_STYLE: Record<HLType, string> = {
  metric:      "font-bold text-[#0B7C5C] bg-[#10B9811F] px-1 rounded-[4px] tabular-nums", // 수치+단위
  compare:     "font-bold text-[#0B7C5C] bg-[#10B98114] px-1 rounded-[4px]",               // N배/대비/이상 향상
  superlative: "font-bold text-[#B45309] bg-[#FEF3C7] px-1 rounded-[4px]",                 // 최초/유일/독보적
  solution:    "font-semibold text-[#047857] underline decoration-[#10B98166] decoration-2 underline-offset-[3px]", // 해결/개선/극복/달성
  problem:     "font-semibold text-[#B91C1C]",                                              // 문제/한계/어려움
  concept:     "font-semibold text-[#191F28]",                                              // 핵심 개념(명사+기술/공법…)
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
  // 5) 문제/한계 표현
  { type: "problem",     regex: /([가-힣A-Za-z]{2,12}(?:의)?\s*(?:문제점?|한계점?|어려움|단점|취약점|부족|불편|손실|오류|결함)|기존\s*기술의?\s*[가-힣]{0,10}한계|종래\s*기술|종래\s*방식)/g },
  // 7) 핵심 개념 명사구 (… 기술/시스템/공법/방식/장치/모듈/메커니즘/알고리즘/플랫폼/구조)
  { type: "concept",     regex: /([가-힣A-Za-z]{2,15}(?:\s*[가-힣A-Za-z]{1,10}){0,2}\s*(?:기술|시스템|공법|방식|장치|모듈|메커니즘|알고리즘|플랫폼|구조|구성|프로세스|솔루션))/g },
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

type KeywordCategory = "function" | "industry" | "material" | "product" | "tech" | "general";

const CATEGORY_STYLE: Record<KeywordCategory, { bg: string; text: string; border: string; label: string }> = {
  function: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "주요기능" },
  industry: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "활용산업" },
  material: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", label: "소재" },
  product:  { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", label: "최종제품" },
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


function sectionMeta(title: string): { kicker: string; heading: string; Icon: typeof Lightbulb } {
  if (/기술\s*분야/.test(title)) return { kicker: "기술 분야", heading: "어떤 기술인가요?", Icon: Lightbulb };
  if (/발명|요약|특징/.test(title)) return { kicker: "발명 요약", heading: "무엇을 해결하나요?", Icon: FileText };
  if (/시장|동향/.test(title)) return { kicker: "시장 동향", heading: "시장은 어떻게 움직이나요?", Icon: TrendingUp };
  if (/농산업|활용|응용/.test(title)) return { kicker: "농산업 활용", heading: "어디에 쓸 수 있나요?", Icon: Leaf };
  if (/상용화|사업화|전망|성숙/.test(title)) return { kicker: "상용화 전망", heading: "사업화 가능성은?", Icon: Rocket };
  return { kicker: title, heading: title, Icon: FileText };
}

// 디자인 개편 전 키워드 로직 복원: IPC + 제목/초록 기반의 다층 라벨 추출.
// 카테고리 별 라벨을 직접 만들어 색상 구분에 그대로 사용한다.
type KwItem = { word: string; cat: KeywordCategory };
function extractKeywordsFromPatent(
  patentData: { titleKo?: string; title?: string; abstract?: string; classifications?: string[] } | null | undefined,
  max = 8,
): KwItem[] {
  if (!patentData) return [];
  const title = patentData.titleKo || patentData.title || "";
  const text = `${title} ${patentData.abstract || ""}`;

  const industryKws: string[] = [];
  const funcKws: string[] = [];
  const featKws: string[] = [];
  const subjectKws: string[] = [];
  const productKws: string[] = [];

  // 1) IPC → 활용가능 산업
  if (patentData.classifications?.length) {
    const ipcIndustryMap: Record<string, string> = {
      A23L: "건강기능식품", A23B: "식품저장", A23C: "유제품", A23D: "유지식품",
      A23F: "음료", A23G: "제과", A23J: "단백질식품", A23K: "사료",
      A23P: "식품가공", A22C: "축산식품", A22B: "도축",
      A01G: "스마트팜", A01H: "품종개량", A01K: "스마트축산",
      A01N: "농약·방제", A01C: "정밀농업", A01D: "수확기계", A01J: "유가공",
      A01F: "수확후관리",
      A61K: "의약품", A61P: "치료제", A61B: "의료기기", A61F: "의료용품",
      A61L: "의료위생", A61Q: "화장품",
      B01D: "화학공정", B01J: "촉매산업", B01F: "혼합공정",
      B02C: "분쇄산업", B29C: "성형산업", B65B: "포장산업", B09B: "환경산업",
      B02B: "곡물가공", B07B: "선별산업",
      C12N: "바이오산업", C12P: "발효산업", C12G: "주류산업", C12Q: "진단산업",
      C07K: "바이오의약", C07D: "정밀화학", C08L: "소재산업",
      C05G: "비료산업", C02F: "수처리산업",
      G06F: "AI·SW", G06N: "AI산업", G06Q: "유통·물류", G01N: "분석·검사",
      G16B: "바이오IT", G05B: "자동화산업",
      H04L: "IoT", H04W: "무선통신",
      F26B: "건조산업", F25D: "냉장냉동산업",
      A23: "식품산업", A01: "농업", A22: "축산업", A61: "헬스케어",
      C12: "바이오산업", C07: "의약화학", C08: "소재산업",
      G06: "ICT", B01: "화학공정", H04: "IoT", G01: "계측산업",
      B65: "물류산업", B02: "곡물가공", F26: "건조산업",
    };
    patentData.classifications.forEach((cls) => {
      const c = cls.replace(/\s/g, "");
      const k = ipcIndustryMap[c.slice(0, 4)] || ipcIndustryMap[c.slice(0, 3)];
      if (k && !industryKws.includes(k)) industryKws.push(k);
    });
  }

  // 2) 제목+초록 → 활용가능 산업 보강
  const industryPatterns: [RegExp, string][] = [
    [/식품|음식료|식음료/, "식품산업"], [/화장품|뷰티산업|미용제품/, "화장품산업"],
    [/의약품|제약|의약조성물/, "제약산업"], [/사료|가축|축산/, "축산업"],
    [/비료|퇴비|토양개량/, "비료산업"], [/건강기능식품|건기식|기능성\s*식품/, "건강기능식품"],
    [/수산물|어류양식|양식장/, "수산업"], [/섬유산업|직물|의류/, "섬유산업"],
    [/태양광|바이오매스|신재생에너지/, "에너지산업"], [/폐수처리|폐기물처리|환경정화/, "환경산업"],
    [/반도체|전자제품|전자부품|전자기기산업/, "전자산업"], [/건설현장|건축자재|건축물/, "건설산업"],
  ];
  industryPatterns.forEach(([p, l]) => { if (p.test(text) && !industryKws.includes(l)) industryKws.push(l); });

  // 3) 제목+초록 → 기능성
  // 주의: 단일 1~2자 한글 토큰은 동음이의/부분일치로 오매칭이 잦으므로 항상 복합어 또는 구문 단위로 매칭한다.
  const funcPatterns: [RegExp, string][] = [
    [/항균|살균|멸균|항미생물/, "항균"], [/항산화|산화방지|자유라디칼/, "항산화"],
    [/항염|소염|염증억제/, "항염"], [/항암|종양억제|암세포\s*억제/, "항암"],
    [/항바이러스|바이러스\s*억제/, "항바이러스"],
    [/면역\s*강화|면역력|면역\s*조절/, "면역강화"], [/혈당|당뇨|인슐린/, "혈당조절"],
    [/혈압|고혈압|저혈압/, "혈압조절"], [/비만|체중\s*감소|지방\s*분해/, "체중조절"],
    [/치매|인지\s*기능|기억력/, "인지개선"], [/피부\s*개선|피부\s*보습|보습력|주름\s*개선/, "피부개선"],
    [/발효|숙성|유산균/, "발효기능"], [/프로바이오|장\s*건강|장내\s*세균|장내\s*환경/, "장건강"],
    [/콜라겐|피부\s*탄력|탄력\s*개선/, "피부탄력"], [/노화\s*방지|안티에이징|항노화/, "항노화"],
    [/수분\s*보유|보수력/, "보수성"], [/유화\s*안정|유화\s*분산/, "유화안정"],
    [/점도\s*조절|겔화|겔형/, "점도조절"], [/방부|보존성|저장성|장기\s*보관/, "보존성향상"],
    [/흡착\s*제거|흡착\s*능|흡수\s*촉진/, "흡착기능"], [/소취|탈취|악취\s*제거/, "소취기능"],
    [/진통|통증\s*완화/, "진통효과"], [/이뇨|배뇨/, "이뇨작용"],
    [/간\s*보호|간\s*기능\s*개선/, "간기능개선"], [/골밀도|골다공|뼈\s*건강|골\s*건강/, "골건강"],
    // 축산·가금 가공 공정
    [/도계|도축|도살/, "도축공정"],
    [/탈모(?:기|봉|공정)?|탈피|깃털\s*제거|모(?:털)?\s*제거/, "깃털제거"],
    [/내장\s*제거|박피|발골|해체\s*가공/, "해체가공"],
    // 일반 가공·자동화 공정
    [/선별|정선|등급\s*판정/, "선별처리"],
    [/자동\s*포장|포장\s*공정|패킹\s*공정/, "포장공정"],
    [/세척|세정|클리닝/, "세척처리"],
    [/이송\s*장치|컨베이어|운반\s*장치/, "이송처리"],
    [/혼합\s*공정|배합\s*공정|믹싱/, "혼합공정"],
  ];
  funcPatterns.forEach(([p, l]) => { if (p.test(text) && !funcKws.includes(l)) funcKws.push(l); });

  // 4) 제목+초록 → 기술/특징
  const featPatterns: [RegExp, string][] = [
    [/나노입자|나노캡슐|나노기술|나노소재/, "나노기술"], [/마이크로캡슐|마이크로\s*입자/, "마이크로캡슐"],
    [/코팅\s*층|코팅\s*막|피복|코팅\s*기술|코팅\s*처리/, "코팅기술"], [/추출\s*공정|용매\s*추출|분리\s*정제/, "추출정제"],
    [/건조\s*공정|동결\s*건조|열풍\s*건조|진공\s*건조/, "건조공정"], [/분쇄|미분|초미분/, "미분화"],
    [/캡슐화|캡슐형|포접|마이크로\s*캡슐화/, "캡슐화"], [/수경\s*재배|양액\s*재배/, "수경재배"],
    [/드론|무인\s*비행/, "드론활용"], [/IoT|사물인터넷|센서\s*네트워크|센서\s*기반/, "IoT기반"],
    [/인공지능|딥러닝|머신러닝|기계학습|\bAI\b/, "AI활용"], [/로봇|자동화\s*시스템|자동화\s*공정/, "자동화"],
    [/친환경|유기농|무농약/, "친환경"], [/저온\s*처리|저온\s*공정|저온\s*보관/, "저온공정"],
    [/고압\s*처리|초고압|고온\s*고압/, "고압처리"], [/효소\s*처리|효소\s*분해|효소적\s*반응/, "효소처리"],
    [/미생물|균주|접종/, "미생물활용"], [/세포\s*배양|미생물\s*배양|배양\s*공정/, "배양기술"],
    [/유전자|형질전환|게놈|유전체/, "유전공학"], [/3D\s*프린팅|삼차원\s*인쇄|적층\s*제조/, "3D기술"],
    [/블록체인|이력\s*추적/, "이력추적"], [/빅데이터|데이터\s*분석/, "빅데이터"],
    [/복합\s*기술|융합\s*기술|하이브리드/, "복합기술"], [/실시간\s*모니터링|상시\s*모니터링/, "실시간모니터링"],
    [/영상\s*분석|이미지\s*분석|머신\s*비전/, "영상분석"], [/스펙트럼\s*분석|분광\s*분석/, "분광분석"],
    // 기계·구동 메커니즘
    [/회전\s*플레이트|회전체|회전\s*가능|회전\s*구동|회전[가-힣\s]{0,8}구동/, "회전구동"],
    [/구동\s*모터|구동\s*유닛|구동력|전동\s*모터/, "모터구동"],
    [/브러쉬|브러시/, "브러시처리"],
    [/하우징|챔버\s*구조|반응\s*챔버/, "하우징구조"],
    [/회전\s*플레이트|디스크\s*형|드럼\s*형/, "회전체구조"],
    [/안내홀|배출구|배출\s*공간|배출\s*구조/, "배출구조"],
  ];
  featPatterns.forEach(([p, l]) => { if (p.test(text) && !featKws.includes(l)) featKws.push(l); });

  // 5) 소재 (제목 기반, 앞에 배치)
  // 주의: '김','밀','솔' 같은 1글자 토큰은 다른 단어의 일부에 매칭되므로 복합어 형태로만 사용한다.
  const subjectPatterns: [RegExp, string][] = [
    [/쌀|미곡|현미|백미/, "쌀"], [/밀가루|소맥분|밀\s*기울|밀\s*짚|소맥/, "밀"], [/보리|맥주\s*보리/, "보리"], [/옥수수/, "옥수수"],
    [/대두|콩(?:나물|기름|가루|류|즙|단백)?|검정콩|서리태/, "콩"], [/인삼|홍삼|수삼|산양삼/, "인삼"], [/녹차|차(?:잎|나무|류)/, "차"],
    [/고추(?!장)|고춧가루/, "고추"], [/마늘/, "마늘"], [/양파/, "양파"], [/배추/, "배추"],
    [/토마토/, "토마토"], [/감자(?!튀김)/, "감자"], [/고구마/, "고구마"],
    [/딸기/, "딸기"], [/사과(?!나무|드림)?/, "사과"], [/포도/, "포도"], [/감귤|귤(?!피)?/, "감귤"],
    [/블루베리/, "블루베리"], [/버섯/, "버섯"], [/김치/, "김치"],
    [/한우|소고기|한우육/, "한우"], [/돼지|돈육|양돈/, "돼지"], [/육계|산란계|가금류?|오리(?!엔트)|메추리|닭(?:고기|육|계)?/, "가금"],
    [/우유|원유|유청/, "우유"], [/계란|달걀/, "계란"],
    [/새우/, "새우"], [/김\s*양식|마른\s*김|조미\s*김|해조류/, "해조류"], [/미역/, "미역"],
    [/꿀|벌꿀|봉밀/, "꿀"], [/유산균|젖산균/, "유산균"], [/효모|이스트/, "효모"],
    [/키토산/, "키토산"], [/펙틴/, "펙틴"], [/폴리페놀/, "폴리페놀"],
    [/단백질/, "단백질"], [/전분|녹말/, "전분"], [/셀룰로오스|섬유소/, "셀룰로오스"],
  ];
  // 소재는 제목 우선, 미매칭 시 본문에서도 매칭
  subjectPatterns.forEach(([p, l]) => { if (p.test(title) && !subjectKws.includes(l)) subjectKws.push(l); });
  if (subjectKws.length === 0) {
    subjectPatterns.forEach(([p, l]) => { if (p.test(text) && !subjectKws.includes(l)) subjectKws.push(l); });
  }

  // 6) 제목+초록 → 최종제품 (소비자 형태로 출시될 산출물)
  // 주의: '환','크림','시트','솔루션','서비스' 같은 단어는 산업 일반에서 다른 의미로 흔히 사용되므로 반드시 복합어 형태로 매칭.
  const productPatterns: [RegExp, string][] = [
    [/건강기능식품|건기식|기능성\s*식품/, "건강기능식품"],
    [/음료(?!수)|드링크|차\s*제품|주스|스무디/, "음료"],
    // NOTE: '조성물'은 특허 청구항의 일반 용어(프라이머·키트·비료·사료에도 사용)이므로 단독 매칭 금지.
    // '환' 단독은 "환기/환경/순환"에, '제제/정제'는 "정제수" 등에 오매칭되므로 약학·식이 제형 의도 표현에서만 매칭.
    [/약학(?:적|용)?\s*조성물|식이\s*조성물|경구\s*투여\s*조성물|제형\s*화|환제|환약|시럽\s*제|연고\s*제|약학\s*제제|정제\s*제형/, "제형 제품"],
    [/화장품|스킨\s*케어|스킨\s*크림|로션|에센스|마스크팩|미용\s*세럼/, "화장품"],
    [/사료|배합\s*사료|반려동물\s*사료|펫푸드/, "사료"],
    [/비료|퇴비|토양\s*개량제/, "비료"],
    [/스낵|과자|간식|빵|면류|국수|만두|소스|장류|발효식품|김치/, "가공식품"],
    [/유제품|치즈|요거트|버터|분유/, "유제품"],
    [/의약품|치료제|진단\s*키트|의료기기|의료용품/, "의료제품"],
    [/포장\s*필름|포장\s*시트|패키징|포장재|보관\s*용기|식품\s*용기/, "포장·소재 제품"],
    [/장치|시스템|설비|기계|로봇|드론|센서\s*모듈|모니터링\s*시스템/, "장치·시스템"],
    [/플랫폼|서비스\s*제공|모바일\s*앱|애플리케이션|소프트웨어\s*솔루션/, "플랫폼·서비스"],
    [/종자|종균|품종|모종/, "종자·종균"],
    [/추출물|분말|원료\s*소재|기능성\s*성분/, "원료 소재"],
  ];
  productPatterns.forEach(([p, l]) => { if (p.test(text) && !productKws.includes(l)) productKws.push(l); });

  // ----- 폴백: 핵심 4개 카테고리(소재·주요기능·활용산업·최종제품)는 최소 1개 보장 -----
  // 제목에서 의미있는 명사 추출 (의미 없는 "핵심 소재"/"핵심 기능" 라벨을 피하기 위함)
  const extractTitleNouns = (): string[] => {
    if (!title) return [];
    const STOP = new Set([
      "발명", "본", "방법", "장치", "시스템", "이를", "포함", "포함하는", "제공", "관한",
      "그", "및", "또는", "위한", "사용", "이용", "구비", "구성", "기술", "특징", "수단",
      "구비하는", "구성된", "이루어진", "사용하는", "이용하는",
    ]);
    const cleaned = title
      .replace(/[\[\](){}<>"'`·,.\-—–:;?!]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const tokens = cleaned.split(/\s+/).filter(t => /[가-힣A-Za-z]/.test(t));
    const nouns: string[] = [];
    for (const t of tokens) {
      // 조사 제거: ~의/~를/~을/~이/~가/~에서/~로/~으로
      const stem = t.replace(/(?:으로|에서|로서|로써|에게|에서|에|의|를|을|이|가|와|과|로|은|는)$/u, "");
      if (stem.length < 2 || stem.length > 8) continue;
      if (STOP.has(stem)) continue;
      if (/^\d+$/.test(stem)) continue;
      if (!nouns.includes(stem)) nouns.push(stem);
      if (nouns.length >= 3) break;
    }
    return nouns;
  };

  if (subjectKws.length === 0) {
    if (/식품|음료|건기식|발효|가공/.test(text)) subjectKws.push("식품 원료");
    else if (/작물|재배|농산물|곡물|채소|과일/.test(text)) subjectKws.push("농산 원료");
    else if (/축산|가축|사료|도계|도축|가금/.test(text)) subjectKws.push("축산 원료");
    else if (/소재|재료|성분|물질|추출물|분말/.test(text)) subjectKws.push("기능성 소재");
    else {
      // 마지막 폴백: 제목 명사 사용 (의미 없는 "핵심 소재" 라벨 회피)
      const titleNouns = extractTitleNouns();
      if (titleNouns.length > 0) subjectKws.push(titleNouns[0]);
      else subjectKws.push("처리 대상");
    }
  }
  if (funcKws.length === 0) {
    if (/측정|분석|감지|판별|진단|검출|모니터링/.test(text)) funcKws.push("측정·분석");
    else if (/제어|관리|운영|자동/.test(text)) funcKws.push("제어·관리");
    else if (/처리|가공|공정|제조/.test(text)) funcKws.push("가공·처리");
    else if (/개선|향상|증대|효율|최적화|품질/.test(text)) funcKws.push("성능 개선");
    else {
      const titleNouns = extractTitleNouns();
      // 제목에 '~기' 또는 '~장치' 등이 있으면 그것 자체가 핵심 기능을 함의
      const fnNoun = titleNouns.find(n => /기$|장치$|시스템$|모듈$|유닛$/.test(n)) || titleNouns[0];
      if (fnNoun) funcKws.push(fnNoun);
      else funcKws.push("핵심 기능");
    }
  }
  if (industryKws.length === 0) {
    if (/식품|음료|건기식|발효/.test(text)) industryKws.push("식품산업");
    else if (/작물|재배|농산|곡물|채소|과일|스마트팜/.test(text)) industryKws.push("농업");
    else if (/축산|가축|사료|도계|도축|가금|육계|닭|오리/.test(text)) industryKws.push("축산업");
    else if (/의약|제약|치료|진단/.test(text)) industryKws.push("제약·의료");
    else if (/화장품|미용|뷰티/.test(text)) industryKws.push("화장품산업");
    else if (/환경|폐수|폐기물/.test(text)) industryKws.push("환경산업");
    else industryKws.push("농식품산업");
  }
  if (productKws.length === 0) {
    // 우선순위: 진단키트·장치 → 사료/비료 → 가공식품 → 제형(약학) → 원료 소재
    if (/진단\s*키트|판별\s*키트|검출\s*키트|프라이머\s*세트|판별\s*용\s*조성물/.test(text)) productKws.push("진단·검사 키트");
    else if (/장치|시스템|설비|기계|모듈|하우징|챔버/.test(text)) productKws.push("장치·시스템");
    else if (/사료/.test(text)) productKws.push("사료");
    else if (/비료|퇴비/.test(text)) productKws.push("비료");
    else if (/식품|음료|가공\s*식품/.test(text)) productKws.push("가공식품");
    else if (/약학(?:적|용)?\s*조성물|환제|환약|시럽\s*제|연고\s*제/.test(text)) productKws.push("제형 제품");
    else if (/추출물|분말|원료\s*소재|기능성\s*성분/.test(text)) productKws.push("원료 소재");
    else productKws.push("응용 제품");
  }

  // 조합: 소재 → 주요기능 → 활용산업 → 최종제품 → 기술특징
  // 핵심 4개 카테고리는 각각 최소 1개를 먼저 확보하여 항상 4개 이상 노출되도록 보장.
  const seen = new Set<string>();
  const unique: KwItem[] = [];
  const push = (word: string, cat: KeywordCategory) => {
    if (!word || seen.has(word) || unique.length >= max) return;
    seen.add(word);
    unique.push({ word, cat });
  };

  // 1라운드: 각 핵심 카테고리에서 최소 1개씩
  push(subjectKws[0], "material");
  push(funcKws[0], "function");
  push(industryKws[0], "industry");
  push(productKws[0], "product");

  // 2라운드: 비중 있게 추가
  subjectKws.slice(1, 2).forEach((w) => push(w, "material"));
  funcKws.slice(1, 3).forEach((w) => push(w, "function"));
  industryKws.slice(1, 3).forEach((w) => push(w, "industry"));
  productKws.slice(1, 2).forEach((w) => push(w, "product"));
  featKws.slice(0, 3).forEach((w) => push(w, "tech"));

  return unique;
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
  const keywords = useMemo(() => extractKeywordsFromPatent(patentData, 8), [patentData]);

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

      <div className="bg-white rounded-[24px] border border-[#F2F4F6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden max-w-[720px] mx-auto">
        <div className="px-5 sm:px-7 pb-12">
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
                    (acc[k.cat] ||= []).push(k.word);
                    return acc;
                  }, { function: [], industry: [], material: [], product: [], tech: [], general: [] });
                  const order: KeywordCategory[] = ["material", "function", "industry", "product", "tech", "general"];
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