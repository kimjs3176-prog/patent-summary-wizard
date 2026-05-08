import { ArrowUpRight, ChevronRight, Sparkles, Building2, Calendar, FileText, Lightbulb, Target, TrendingUp, Leaf, Share2, Bookmark, Download } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * 토스앱 스타일 요약서 시안 (샘플).
 * - 흰 배경 + 큰 여백 + 굵은 숫자/타이틀
 * - 카드는 얇은 보더 없이 부드러운 회색 면(bg-[#F2F4F6])
 * - 섹션 사이 간격 크게, 라운드 20px+, 한 화면에 한 메시지
 */

const SOFT = "#F2F4F6"; // 토스 그레이
const SOFT_2 = "#F9FAFB";
const ACCENT = "#3182F6"; // 토스 블루 (시안용 — 적용 시 emerald primary로 교체)

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
      {kicker && <p className="text-[13px] font-semibold text-[#3182F6] mb-1.5">{kicker}</p>}
      <h2 className="text-[22px] sm:text-[24px] font-bold text-[#191F28] tracking-[-0.02em] leading-[1.3]">
        {children}
      </h2>
    </div>
  );
}

function SoftCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] p-5 sm:p-6 ${className}`}
      style={{ background: SOFT }}
    >
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
          {value}
          <span className="text-[12px] text-[#8B95A1] ml-0.5">점</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#E5E8EB] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
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

export default function SummarySample() {
  const trl = 6;

  return (
    <div className="min-h-screen bg-white text-[#191F28]" style={{ fontFamily: "'Pretendard','Inter',sans-serif" }}>
      {/* Top bar — 토스 스타일 미니멀 */}
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-md border-b border-[#F2F4F6]">
        <div className="max-w-[640px] mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="text-[15px] font-bold text-[#191F28]">← 요약서 시안</Link>
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]">
              <Bookmark className="w-[18px] h-[18px]" />
            </button>
            <button className="w-9 h-9 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]">
              <Share2 className="w-[18px] h-[18px]" />
            </button>
            <button className="w-9 h-9 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]">
              <Download className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-5 pb-24">
        {/* HERO — 한 줄 메시지 + 큰 숫자 */}
        <section className="pt-10 pb-8">
          <p className="text-[13px] font-semibold text-[#3182F6] mb-3">AI 종합 평가</p>
          <h1 className="text-[28px] sm:text-[32px] font-bold leading-[1.25] tracking-[-0.02em] mb-6">
            상용화 잠재력이<br />
            <span style={{ color: ACCENT }}>높은 편</span>이에요
          </h1>

          <div className="flex items-end gap-3 mb-2">
            <span className="text-[72px] font-bold leading-none tabular-nums tracking-tight" style={{ color: ACCENT }}>
              82
            </span>
            <span className="text-[20px] text-[#8B95A1] font-semibold mb-2">/ 100점</span>
          </div>
          <p className="text-[14px] text-[#8B95A1] font-medium">
            동일 분야 특허 상위 18% 수준
          </p>
        </section>

        {/* 핵심 지표 — 가로 분할 */}
        <section className="mb-3">
          <SoftCard>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="기술성" value="85" suffix="점" />
              <Stat label="시장성" value="78" suffix="점" />
              <Stat label="사업성" value="82" suffix="점" />
            </div>
          </SoftCard>
        </section>

        {/* TRL — 한 줄 시각화 */}
        <section className="mb-10">
          <SoftCard>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-[13px] text-[#8B95A1] font-medium mb-1">기술 성숙도 (TRL)</p>
                <p className="text-[18px] font-bold">
                  <span className="text-[24px]" style={{ color: "#F59E0B" }}>{trl}</span>
                  <span className="text-[#8B95A1] text-[14px] font-semibold ml-1">/ 9 단계</span>
                </p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[12px] font-bold text-white"
                style={{ background: "#F59E0B" }}
              >
                개발/실증
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 9 }).map((_, i) => {
                const lvl = i + 1;
                const active = lvl <= trl;
                const c = lvl <= 3 ? "#EF4444" : lvl <= 6 ? "#F59E0B" : "#10B981";
                return (
                  <div
                    key={i}
                    className="flex-1 h-1.5 rounded-full"
                    style={{ background: active ? c : "#E5E8EB" }}
                  />
                );
              })}
            </div>
          </SoftCard>
        </section>

        {/* 특허 정보 — Toss 거래내역 스타일 리스트 */}
        <section className="mb-10">
          <SectionTitle kicker="특허 정보">한눈에 보는 기본 정보</SectionTitle>
          <SoftCard className="!p-2 !sm:p-2">
            <div className="bg-white rounded-[16px] px-5">
              <Row label="출원번호" value="10-2023-0123456" />
              <Row label="출원일자" value="2023.08.15" />
              <Row label="출원인" value="농촌진흥청" />
              <Row label="발명자" value="김OO 외 3인" />
              <Row label="IPC 분류" value="A01G 7/00" />
            </div>
          </SoftCard>
        </section>

        {/* 점수 디테일 */}
        <section className="mb-10">
          <SectionTitle kicker="세부 점수">왜 이 점수인가요?</SectionTitle>
          <SoftCard>
            <div className="space-y-5">
              <ScoreBar label="기술성" value={85} color="#3182F6" />
              <ScoreBar label="시장성" value={78} color="#10B981" />
              <ScoreBar label="사업성" value={82} color="#F59E0B" />
            </div>
          </SoftCard>
        </section>

        {/* 키워드 */}
        <section className="mb-10">
          <SectionTitle kicker="핵심 키워드">기술의 정체성</SectionTitle>
          <SoftCard>
            <div className="flex flex-wrap gap-2">
              {["스마트팜", "센서융합", "병해충 진단", "딥러닝", "이미지 분석", "엣지컴퓨팅"].map((k) => (
                <KeywordChip key={k}>{k}</KeywordChip>
              ))}
            </div>
          </SoftCard>
        </section>

        {/* 발명요약 — 본문 */}
        <section className="mb-10">
          <SectionTitle kicker="발명 요약">무엇을 해결하나요?</SectionTitle>
          <div className="space-y-4">
            <p className="text-[16px] leading-[1.75] text-[#4E5968]">
              본 발명은 농작물의 병해충을 <strong className="text-[#191F28] font-bold">실시간으로 진단</strong>하고
              방제 시점을 자동 결정하는 스마트팜 시스템에 관한 것입니다.
            </p>
            <p className="text-[16px] leading-[1.75] text-[#4E5968]">
              기존 인력 기반 예찰의 한계를 극복하기 위해 <strong className="text-[#191F28] font-bold">엣지 디바이스에서 동작하는 경량 딥러닝 모델</strong>을 적용,
              네트워크가 불안정한 농촌 환경에서도 안정적인 진단이 가능합니다.
            </p>
          </div>
        </section>

        {/* AI 의견 — 강조 카드 */}
        <section className="mb-10">
          <div
            className="rounded-[20px] p-6"
            style={{
              background: "linear-gradient(135deg, #EBF3FF 0%, #F4F8FF 100%)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <p className="text-[13px] font-bold" style={{ color: ACCENT }}>
                AI 종합 분석
              </p>
            </div>
            <p className="text-[15px] leading-[1.75] text-[#191F28] font-medium">
              스마트팜 시장 성장세와 맞물려 <strong className="font-bold">단기 사업화 가능성</strong>이 높습니다.
              다만 경쟁 특허 다수 존재로 차별화 포인트의 명확한 정의가 필요합니다.
            </p>
          </div>
        </section>

        {/* 액션 — 큰 버튼 */}
        <section className="mb-6">
          <button
            className="w-full h-14 rounded-[16px] text-[16px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99]"
            style={{ background: ACCENT }}
          >
            전체 보고서 다운로드
          </button>
          <button className="w-full h-14 rounded-[16px] text-[16px] font-bold text-[#191F28] mt-2 hover:bg-[#F2F4F6] transition-all">
            유사 특허 비교하기
          </button>
        </section>

        {/* Disclaimer */}
        <p className="text-[12px] text-[#8B95A1] text-center leading-relaxed mt-8">
          ※ 본 분석은 특허명세서를 바탕으로 실시하여<br />실제 연구 및 개발 단계와는 상이할 수 있습니다.
        </p>
      </main>
    </div>
  );
}
