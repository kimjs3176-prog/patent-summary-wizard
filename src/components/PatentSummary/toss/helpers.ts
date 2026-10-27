import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import { Lightbulb, FileText, TrendingUp, Leaf, Rocket } from "lucide-react";
import { normalizeCommercializationProse } from "@/lib/summaryProse";

export const ACCENT_HEX = "#10B981";

type PatentStatusTone = "registered" | "published" | "pending" | "inactive" | "unknown";

export function getPatentStatus(data?: BasePatentSummaryProps["patentData"]): { label: string; tone: PatentStatusTone } {
  const raw = data?.legalStatus?.trim() || "";
  const compact = raw.replace(/\s+/g, "");

  if (/(거절)/.test(compact)) return { label: "거절", tone: "inactive" };
  if (/(소멸)/.test(compact)) return { label: "소멸", tone: "inactive" };
  if (/(취하)/.test(compact)) return { label: "취하", tone: "inactive" };
  if (/(포기)/.test(compact)) return { label: "포기", tone: "inactive" };
  if (/(무효)/.test(compact)) return { label: "무효", tone: "inactive" };
  if (/(등록)/.test(compact) || data?.registrationNumber || data?.registrationDate) {
    return { label: "등록", tone: "registered" };
  }
  if (/(공개)/.test(compact) || data?.publicationDate) return { label: "공개", tone: "published" };
  if (/(출원|심사|계속)/.test(compact) || data?.applicationNumber) return { label: "출원", tone: "pending" };
  if (raw) return { label: raw, tone: "unknown" };
  return { label: "상태 확인 중", tone: "unknown" };
}

/**
 * 출원번호: ##-####-####### (13자리)
 * 등록번호: ##-####### (앞 9자리, 뒤 0000 패딩 제거)
 */
export function formatPatentNumber(value: string | undefined | null, kind: 'application' | 'registration'): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (kind === 'application') {
    if (digits.length === 13) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return String(value);
  }
  // registration: 7자리 본번호. 13자리 입력이면 앞 2 + 다음 7만 사용
  if (digits.length >= 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 9)}`;
  }
  return String(value);
}

export function formatAiModelLabel(model?: string): string {
  if (!model) return "Gemini 3.6 Flash";
  const map: Record<string, string> = {
    "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
    "google/gemini-2.5-pro": "Gemini 2.5 Pro",
    "google/gemini-3.6-flash": "Gemini 3.6 Flash",
    "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
    "openai/gpt-5": "GPT-5",
    "openai/gpt-5-mini": "GPT-5 Mini",
    "openai/gpt-5-nano": "GPT-5 Nano",
    "openai/gpt-5.2": "GPT-5.2",
  };
  return map[model] || model.replace(/^.*\//, "");
}

export interface MdSection {
  title: string;
  paragraphs: string[];
  footnotes?: { num: number; text: string }[];
}
export function parseSections(md: string): MdSection[] {
  if (!md) return [];
  const lines = normalizeCommercializationProse(md).split("\n");
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  let buf = "";
  let inSourcesBlock = false; // ### 출처 진입 후 footnote 수집 모드
  const flush = () => {
    if (cur && buf.trim()) cur.paragraphs.push(buf.trim());
    buf = "";
  };
  for (const raw of lines) {
    // 마크다운 강조 표기 처리:
    //  - `**...**` (볼드): 중요도 강조로 유지 (렌더러에서 <strong>)
    //  - `*...*` (이탤릭): 라틴어 학명만 유지, 그 외는 평문화
    let line = raw.replace(/^\s*\*\s+/, "");                    // * bullet → plain text
    line = line.replace(/([.!?。．！？])\s+\*\s+/g, "$1 ");       // mid-line pseudo bullet
    line = line.replace(/\*\*\*([^*\n]+?)\*\*\*/g, "**$1**"); // ***x*** → **x**
    // 볼드 마커 내부에 개행/빈 볼드는 평문화
    line = line.replace(/\*\*\s*\*\*/g, "");
    // 볼드 바깥의 단일 이탤릭 마커만 학명 판정으로 정리
    // (볼드 안쪽은 renderBold에서 처리)
    line = line.replace(/(^|[^*])\*([^*\n]{1,80})\*(?!\*)/g, (_full, pre: string, inner: string) => {
      const looksLikeLatin = /^[A-Za-z][A-Za-z0-9 .\-]{1,60}$/.test(inner.trim());
      return pre + (looksLikeLatin ? `*${inner}*` : inner);
    });
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
      // 본문 인용 마커([^N])가 포함되면 본문 문단이 재개된 것 → 출처 모드 종료
      if (/\[\^\d+\]/.test(line)) {
        inSourcesBlock = false;
        const cleaned = line.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/[`_]/g, "").trim();
        buf += (buf ? " " : "") + cleaned;
        continue;
      }
      const numbered = line.match(/^\s*(?:[-•]|\d+\.)\s*(.+?)\s*$/);
      const txt = (numbered ? numbered[1] : line).trim();
      if (txt) {
        const next = (cur.footnotes!.length || 0) + 1;
        cur.footnotes!.push({ num: next, text: txt });
      }
      continue;
    }
    const cleaned = line.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/[`_]/g, "").trim();
    buf += (buf ? " " : "") + cleaned;
  }
  flush();
  if (cur) sections.push(cur);
  // 각주 정리: (1) 동일 텍스트 중복 제거, (2) 1부터 재번호
  for (const s of sections) {
    if (!s.footnotes || s.footnotes.length === 0) continue;
    const seen = new Set<string>();
    const dedup: { num: number; text: string }[] = [];
    const renumber = new Map<number, number>(); // 원본 num → 새 num
    for (const f of s.footnotes) {
      const key = f.text.replace(/\s+/g, " ").trim();
      if (!key) continue;
      if (seen.has(key)) {
        // 중복 출처 — 기존 번호로 매핑
        const existing = dedup.find((d) => d.text.replace(/\s+/g, " ").trim() === key);
        if (existing) renumber.set(f.num, existing.num);
        continue;
      }
      seen.add(key);
      const newNum = dedup.length + 1;
      renumber.set(f.num, newNum);
      dedup.push({ num: newNum, text: f.text });
    }
    s.footnotes = dedup;
    // 본문 단락의 [^N] 인라인 마커를 재번호에 맞춰 갱신
    s.paragraphs = s.paragraphs.map((p) =>
      p.replace(/\[\^(\d+)\]/g, (m, n) => {
        const mapped = renumber.get(parseInt(n, 10));
        return mapped ? `[^${mapped}]` : m;
      }),
    );
    // 본문에 인라인 각주 마커가 하나도 없으면, 마지막 단락 끝에 모든 출처 번호를 자동 부착
    const hasInline = s.paragraphs.some((p) => /\[\^\d+\]/.test(p));
    if (!hasInline && dedup.length > 0 && s.paragraphs.length > 0) {
      const markers = dedup.map((d) => `[^${d.num}]`).join("");
      const lastIdx = s.paragraphs.length - 1;
      s.paragraphs[lastIdx] = s.paragraphs[lastIdx].replace(/\s*$/, "") + markers;
    }
  }
  const parsed = sections.filter(s =>
    !/특허\s*기본\s*정보/i.test(s.title) &&
    (s.paragraphs.length > 0 || (s.footnotes && s.footnotes.length > 0))
  );
  if (parsed.length > 0) return parsed;

  const fallback = md
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^[-–—]{3,}$/.test(line))
    .filter((line) => !/^특허\s*기본\s*정보$/i.test(line));
  return fallback.length > 0 ? [{ title: "AI 요약", paragraphs: fallback, footnotes: [] }] : [];
}


export function sectionMeta(title: string): { kicker: string; heading: string; Icon: typeof Lightbulb } {
  if (/기술\s*분야/.test(title)) return { kicker: "기술 분야", heading: "어떤 기술인가요?", Icon: Lightbulb };
  if (/발명|요약|특징/.test(title)) return { kicker: "발명 요약", heading: "무엇을 해결하나요?", Icon: FileText };
  if (/시장|동향/.test(title)) return { kicker: "시장 동향", heading: "시장은 어떻게 움직이나요?", Icon: TrendingUp };
  if (/농산업|활용|응용/.test(title)) return { kicker: "농산업 활용", heading: "어디에 쓸 수 있나요?", Icon: Leaf };
  if (/상용화|사업화|전망|성숙/.test(title)) return { kicker: "상용화 전망", heading: "사업화 가능성은?", Icon: Rocket };
  return { kicker: title, heading: title, Icon: FileText };
}

