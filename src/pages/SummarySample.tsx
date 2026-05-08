import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Bookmark, Share2, Download, Loader2, Lightbulb, TrendingUp, Leaf, Rocket, FileText, Mail, QrCode, X, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import type { CommercializationDetails } from "@/components/PatentSummary/TechnologyCommercializationScore";

const SOFT = "#F2F4F6";
const ACCENT = "hsl(var(--primary))"; // 프로젝트 emerald
const ACCENT_HEX_FALLBACK = "#10B981";

const SAMPLE_PATENT = "10-2017-0078319";

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <p className="text-[13px] text-[#8B95A1] font-medium mb-1.5">{label}</p>
      <p className="text-[22px] font-bold text-[#191F28] tracking-tight tabular-nums">
        {value}
        {suffix && <span className="text-[14px] text-[#8B95A1] font-semibold ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}

function SectionTitle({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-5">
      {kicker && <p className="text-[13px] font-semibold mb-1.5" style={{ color: ACCENT_HEX_FALLBACK }}>{kicker}</p>}
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

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
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
    </div>
  );
}

function KeywordChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white text-[13px] font-semibold text-[#4E5968]">
      {children}
    </span>
  );
}

// 마크다운을 ## 헤딩 단위 섹션으로 분할
interface MdSection { title: string; paragraphs: string[]; }
function parseSections(md: string): MdSection[] {
  if (!md) return [];
  const lines = md.split("\n");
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  let buf = "";
  const flush = () => {
    if (cur && buf.trim()) cur.paragraphs.push(buf.trim());
    buf = "";
  };
  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, "");
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      flush();
      if (cur) sections.push(cur);
      cur = { title: h[1].trim(), paragraphs: [] };
      continue;
    }
    if (/^#{3,6}\s/.test(line)) continue;
    if (line.trim() === "") { flush(); continue; }
    // 출처/footnote 라인 제외
    if (/^\[\^\d+\]:/.test(line.trim())) continue;
    const cleaned = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/[`_]/g, "").trim();
    buf += (buf ? " " : "") + cleaned;
  }
  flush();
  if (cur) sections.push(cur);
  // 특허 기본정보 / 출처 섹션 제외
  return sections.filter(s =>
    !/특허\s*기본\s*정보|출처|참고\s*문헌|references?|sources?/i.test(s.title) &&
    s.paragraphs.length > 0
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

// 마크다운에서 ## 기술분야 / ## 발명요약 등에서 키워드 후보 추출 (단순 빈도)
function extractKeywords(md: string, max = 6): string[] {
  if (!md) return [];
  const text = md.replace(/[#*_`>\-\[\]\(\)]/g, " ");
  const tokens = text.match(/[가-힣A-Za-z]{2,}/g) || [];
  const stop = new Set(["특허", "발명", "본", "이를", "통해", "있는", "있다", "수", "및", "등", "위한", "관한", "기술", "방법", "the", "and", "for", "with"]);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (stop.has(t)) continue;
    if (t.length < 2) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
}

export default function SummarySample() {
  const { isLoading, summary, patentData, generateSummary } = usePatentSummary();
  const [score, setScore] = useState<number | null>(null);
  const [details, setDetails] = useState<CommercializationDetails | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1) 진입 시 자동으로 샘플 특허 분석 시작
  useEffect(() => {
    generateSummary(SAMPLE_PATENT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) patentData 준비되면 사업화 점수 호출
  useEffect(() => {
    const run = async () => {
      if (!patentData || isLoading) return;
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
            body: JSON.stringify({ patentNumber: SAMPLE_PATENT, patentData }),
          }
        );
        const json = await res.json();
        if (json.success) {
          setScore(json.score);
          setDetails(json.details);
        }
      } finally {
        setScoreLoading(false);
      }
    };
    run();
  }, [patentData, isLoading]);

  const trl = details?.trl ?? null;
  const trlColor = trl == null ? "#9CA3AF" : trl <= 3 ? "#EF4444" : trl <= 6 ? "#F59E0B" : ACCENT_HEX_FALLBACK;
  const trlStage = trl == null ? "-" : trl <= 3 ? "기초연구" : trl <= 6 ? "개발/실증" : "상용화";

  const title = patentData?.titleKo || patentData?.title || `특허 ${SAMPLE_PATENT}`;
  const sections = parseSections(summary);
  const keywords = extractKeywords(summary, 6);

  // 도면 (대표 도면 + 추가 도면, 중복 제거)
  const drawings: string[] = (() => {
    const list: string[] = [];
    if (patentData?.representativeImage) list.push(patentData.representativeImage);
    if (patentData?.images) for (const u of patentData.images) if (!list.includes(u)) list.push(u);
    return list.slice(0, 4);
  })();
  const proxify = (u: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(u)}`;

  const scoreSummary = score == null
    ? "분석 중"
    : score >= 80 ? "높은 편"
    : score >= 65 ? "보통 수준"
    : "낮은 편";

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = `[특허 요약] ${title}`;
  const shareBody =
    `${title}\n` +
    `· 특허번호: ${SAMPLE_PATENT}\n` +
    (score != null ? `· 사업화 점수: ${score}/100 (${scoreSummary})\n` : "") +
    (trl != null ? `· TRL: ${trl}/9 (${trlStage})\n` : "") +
    `\n전체 요약서 보기:\n${shareUrl}\n`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareBody)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-white text-[#191F28]" style={{ fontFamily: "'Pretendard','Inter',sans-serif" }}>
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-md border-b border-[#F2F4F6]">
        <div className="max-w-[640px] mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="text-[15px] font-bold text-[#191F28]">← 요약서 시안 (실데이터)</Link>
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]"><Bookmark className="w-[18px] h-[18px]" /></button>
            <button onClick={() => setShareOpen(true)} aria-label="공유" className="w-9 h-9 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]"><Share2 className="w-[18px] h-[18px]" /></button>
            <button className="w-9 h-9 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]"><Download className="w-[18px] h-[18px]" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-5 pb-24">
        {/* HERO */}
        <section className="pt-10 pb-8">
          <p className="text-[13px] font-semibold mb-3" style={{ color: ACCENT_HEX_FALLBACK }}>AI 종합 평가</p>
          <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.3] tracking-[-0.02em] mb-2">
            {title}
          </h1>
          <p className="text-[14px] text-[#8B95A1] font-medium mb-6">샘플 특허 · {SAMPLE_PATENT}</p>

          <div className="flex items-end gap-3 mb-2">
            {scoreLoading || score == null ? (
              <div className="flex items-center gap-2 h-[72px]">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT_HEX_FALLBACK }} />
                <span className="text-[16px] text-[#8B95A1] font-semibold">사업화 점수 분석 중...</span>
              </div>
            ) : (
              <>
                <span className="text-[72px] font-bold leading-none tabular-nums tracking-tight" style={{ color: ACCENT_HEX_FALLBACK }}>
                  {score}
                </span>
                <span className="text-[20px] text-[#8B95A1] font-semibold mb-2">/ 100점</span>
              </>
            )}
          </div>
          <p className="text-[14px] text-[#8B95A1] font-medium">상용화 잠재력이 <span className="font-bold text-[#191F28]">{scoreSummary}</span>이에요</p>
        </section>

        {/* 핵심 지표 */}
        <section className="mb-3">
          <SoftCard>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="기술성" value={details?.technologyScore != null ? String(details.technologyScore) : "-"} suffix="점" />
              <Stat label="시장성" value={details?.marketScore != null ? String(details.marketScore) : "-"} suffix="점" />
              <Stat label="사업성" value={details?.businessScore != null ? String(details.businessScore) : "-"} suffix="점" />
            </div>
          </SoftCard>
        </section>

        {/* TRL */}
        <section className="mb-10">
          <SoftCard>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-[13px] text-[#8B95A1] font-medium mb-1">기술 성숙도 (TRL)</p>
                <p className="text-[18px] font-bold">
                  <span className="text-[24px]" style={{ color: trlColor }}>{trl ?? "-"}</span>
                  <span className="text-[#8B95A1] text-[14px] font-semibold ml-1">/ 9 단계</span>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[12px] font-bold text-white" style={{ background: trlColor }}>
                {trlStage}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 9 }).map((_, i) => {
                const lvl = i + 1;
                const active = trl != null && lvl <= trl;
                const c = lvl <= 3 ? "#EF4444" : lvl <= 6 ? "#F59E0B" : ACCENT_HEX_FALLBACK;
                return <div key={i} className="flex-1 h-1.5 rounded-full" style={{ background: active ? c : "#E5E8EB" }} />;
              })}
            </div>
          </SoftCard>
        </section>

        {/* 특허 정보 */}
        <section className="mb-10">
          <SectionTitle kicker="특허 정보">한눈에 보는 기본 정보</SectionTitle>
          <SoftCard className="!p-2">
            <div className="bg-white rounded-[16px] px-5">
              <Row label="출원번호" value={patentData?.applicationNumber || SAMPLE_PATENT} />
              <Row label="출원일자" value={patentData?.filingDate || "-"} />
              {patentData?.registrationNumber && (
                <Row label="등록번호" value={patentData.registrationNumber} />
              )}
              <Row label="공개일자" value={patentData?.publicationDate || "-"} />
              <Row label="출원인" value={patentData?.assignee || "-"} />
              <Row label="발명자" value={patentData?.inventors?.join(", ") || "-"} />
              {patentData?.classifications?.length ? (
                <Row label="IPC 분류" value={patentData.classifications.slice(0, 3).join(", ")} />
              ) : null}
            </div>
          </SoftCard>
        </section>

        {/* 점수 디테일 */}
        {details && (
          <section className="mb-10">
            <SectionTitle kicker="세부 점수">왜 이 점수인가요?</SectionTitle>
            <SoftCard>
              <div className="space-y-5">
                <ScoreBar label="기술성" value={details.technologyScore} color={ACCENT_HEX_FALLBACK} />
                <ScoreBar label="시장성" value={details.marketScore} color="#3B82F6" />
                <ScoreBar label="사업성" value={details.businessScore} color="#F59E0B" />
              </div>
            </SoftCard>
          </section>
        )}

        {/* 키워드 */}
        {keywords.length > 0 && (
          <section className="mb-10">
            <SectionTitle kicker="핵심 키워드">기술의 정체성</SectionTitle>
            <SoftCard>
              <div className="flex flex-wrap gap-2">
                {keywords.map((k) => <KeywordChip key={k}>{k}</KeywordChip>)}
              </div>
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

        {/* AI 요약서의 모든 섹션을 토스 스타일로 매핑 */}
        {isLoading && sections.length === 0 ? (
          <section className="mb-10">
            <div className="flex items-center gap-2 text-[#8B95A1]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[14px]">AI가 요약서를 생성 중입니다...</span>
            </div>
          </section>
        ) : (
          sections.map((sec, idx) => {
            const { kicker, heading, Icon } = sectionMeta(sec.title);
            return (
              <section key={idx} className="mb-10">
                <SectionTitle kicker={kicker}>{heading}</SectionTitle>
                <div className="flex items-center gap-2 mb-3 text-[#4E5968]">
                  <Icon className="w-4 h-4" style={{ color: ACCENT_HEX_FALLBACK }} />
                  <span className="text-[13px] font-semibold">{sec.title}</span>
                </div>
                <div className="space-y-4">
                  {sec.paragraphs.map((p, i) => (
                    <p key={i} className="text-[15.5px] leading-[1.78] text-[#4E5968]">{p}</p>
                  ))}
                </div>
              </section>
            );
          })
        )}

        {/* AI 의견 */}
        {details?.analysis && (
          <section className="mb-10">
            <div className="rounded-[20px] p-6" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 100%)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" style={{ color: ACCENT_HEX_FALLBACK }} />
                </div>
                <p className="text-[13px] font-bold" style={{ color: ACCENT_HEX_FALLBACK }}>AI 종합 분석</p>
              </div>
              <p className="text-[15px] leading-[1.75] text-[#191F28] font-medium">
                {details.analysis}
              </p>
            </div>
          </section>
        )}

        {/* 액션 */}
        <section className="mb-6">
          <button className="w-full h-14 rounded-[16px] text-[16px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99]" style={{ background: ACCENT_HEX_FALLBACK }}>
            전체 보고서 다운로드
          </button>
          <button className="w-full h-14 rounded-[16px] text-[16px] font-bold text-[#191F28] mt-2 hover:bg-[#F2F4F6] transition-all">
            유사 특허 비교하기
          </button>
        </section>

        <p className="text-[12px] text-[#8B95A1] text-center leading-relaxed mt-8">
          ※ 본 분석은 특허명세서를 바탕으로 실시하여<br />실제 연구 및 개발 단계와는 상이할 수 있습니다.
        </p>
      </main>
    </div>
  );
}
