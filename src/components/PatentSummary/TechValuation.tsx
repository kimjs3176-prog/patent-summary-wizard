import { useMemo, useState } from "react";
import { Calculator, ChevronDown, TrendingUp } from "lucide-react";
import {
  calculate, formatKRW, formatNumber, scoreToGrade, trlToStage,
  SCENARIO_META, STAGE_META,
  type Grade, type Scenario, type Stage, type PatentMeta,
} from "@/lib/valuation";
import type { PatentData } from "./types";
import type { CommercializationDetails } from "./TechnologyCommercializationScore";

const ACCENT = "#10B981";
const STAGES: Stage[] = ["기초연구", "실험", "시제품", "실용화", "양산"];
const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

interface Props {
  patentData: PatentData;
  score: number | null;
  details: CommercializationDetails | null;
}

function toMeta(p: PatentData): PatentMeta {
  return {
    registerStatus: p.registrationNumber || p.registrationDate ? "등록" : "공개",
    registerNumber: p.registrationNumber,
    ipcNumber: (p.classifications ?? []).join(" "),
    applicationDate: p.filingDate,
    registerDate: p.registrationDate,
    abstract: p.abstract,
    applicantName: p.assignee,
  };
}

export function TechValuation({ patentData, score, details }: Props) {
  const initTech = scoreToGrade(details?.technologyScore ?? score);
  const initMarket = scoreToGrade(details?.marketScore ?? score);
  const initRights = scoreToGrade(details?.businessScore ?? score);
  const initStage = trlToStage(details?.trl);

  const [revenue, setRevenue] = useState(500); // 백만원
  const [growth, setGrowth] = useState(5); // %
  const [royalty, setRoyalty] = useState(3); // %
  const [techShare, setTechShare] = useState(60); // %
  const [stage, setStage] = useState<Stage>(initStage);
  const [techGrade, setTechGrade] = useState<Grade>(initTech);
  const [marketGrade, setMarketGrade] = useState<Grade>(initMarket);
  const [rightsGrade, setRightsGrade] = useState<Grade>(initRights);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [open, setOpen] = useState(false);

  const result = useMemo(
    () =>
      calculate({
        initialRevenueMM: revenue,
        growthRate: growth / 100,
        royaltyRate: royalty / 100,
        techShare: techShare / 100,
        stage,
        techGrade,
        marketGrade,
        rightsGrade,
        scenario,
        patent: toMeta(patentData),
      }),
    [revenue, growth, royalty, techShare, stage, techGrade, marketGrade, rightsGrade, scenario, patentData],
  );

  return (
    <div className="rounded-[20px] border border-[#E5E8EB] bg-white overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-[#F2F4F6] flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${ACCENT}1A`, color: ACCENT }}
        >
          <Calculator className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-[15px] text-[#191F28] leading-tight">기술가치 간이평가</h4>
          <p className="text-[11.5px] text-[#8B95A1]">로열티공제법(Royalty Relief) 기반 추정 · 단위 백만원</p>
        </div>
      </div>

      {/* 결과 */}
      <div className="px-5 py-5">
        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #0E9F6E)` }}
        >
          <p className="text-[12px] font-medium opacity-90">
            예상 기술가치 ({SCENARIO_META[scenario].label} 시나리오)
          </p>
          <p className="mt-1.5 text-[34px] font-extrabold leading-none tabular-nums">
            {result.formattedTotal}
          </p>
          <p className="mt-1.5 text-[11.5px] opacity-85 tabular-nums">
            NPV {formatNumber(result.totalNPV)} 백만원 · 현금흐름 {result.cashflowYears}년
          </p>
        </div>

        {/* 시나리오 선택 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["pessimistic", "base", "optimistic"] as Scenario[]).map((s) => {
            const active = scenario === s;
            return (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className="rounded-xl border px-2 py-2.5 text-center transition-all"
                style={{
                  borderColor: active ? ACCENT : "#E5E8EB",
                  background: active ? `${ACCENT}0F` : "#fff",
                }}
              >
                <p className="text-[11px] font-semibold text-[#8B95A1]">
                  {SCENARIO_META[s].emoji} {SCENARIO_META[s].label}
                </p>
                <p
                  className="text-[13px] font-bold tabular-nums mt-0.5"
                  style={{ color: active ? ACCENT : "#4E5968" }}
                >
                  {formatKRW(result.scenarioRange[s])}
                </p>
              </button>
            );
          })}
        </div>

        {/* 핵심 지표 */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label="할인율" value={`${(result.discountRate * 100).toFixed(2)}%`} hint={`WACC ${(result.wacc * 100).toFixed(2)}% + 위험 ${(result.riskPremium * 100).toFixed(2)}%`} />
          <Stat label="합리적 로열티율" value={`${(result.effectiveRoyaltyRate * 100).toFixed(2)}%`} hint={`기준 ${royalty}% × 조정 ${result.royaltyAdjFactor.toFixed(2)}`} />
          <Stat label="유효 IP 가치율" value={`${(result.effectiveValidity * 100).toFixed(1)}%`} hint={`특허품질 계수 ${result.patentQualityFactor.toFixed(2)}`} />
          <Stat label="유효경제수명" value={`${result.effectiveLifeYears}년`} hint={`법적 잔존 ${result.legalLifeCap}년`} />
          <Stat label="사업화 소요" value={`${result.leadTimeYears}년`} hint={`${stage} 단계 기준`} />
          <Stat label="기술기여도" value={`${(result.techContribution * 100).toFixed(1)}%`} hint={`산업기술요소 ${(result.industryTechFactor * 100).toFixed(1)}%`} />
        </div>

        {/* 가정 입력 */}
        <div className="mt-4 rounded-2xl border border-[#E5E8EB] p-4">
          <p className="text-[12px] font-bold text-[#4E5968] mb-3">평가 가정 조정</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumField label="초기 연매출 (백만원)" value={revenue} min={0} max={100000} step={50} onChange={setRevenue} />
            <NumField label="연 매출성장률 (%)" value={growth} min={-10} max={40} step={1} onChange={setGrowth} />
            <NumField label="기준 로열티율 (%)" value={royalty} min={0.5} max={15} step={0.5} onChange={setRoyalty} />
            <NumField label="기술비중 (%)" value={techShare} min={5} max={100} step={5} onChange={setTechShare} />
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SelectField label="개발단계" value={stage} options={STAGES} onChange={(v) => setStage(v as Stage)} />
            <SelectField label="기술성 등급" value={techGrade} options={GRADES} onChange={(v) => setTechGrade(v as Grade)} />
            <SelectField label="시장성 등급" value={marketGrade} options={GRADES} onChange={(v) => setMarketGrade(v as Grade)} />
            <SelectField label="권리성 등급" value={rightsGrade} options={GRADES} onChange={(v) => setRightsGrade(v as Grade)} />
          </div>
          <p className="mt-3 text-[11px] text-[#8B95A1] leading-relaxed">
            개발단계는 AI 분석 TRL({details?.trl ?? "-"}), 등급은 AI 기술분석 점수(기술성·시장성·사업성)를 기준으로 자동 설정되며 직접 조정할 수 있습니다.
          </p>
        </div>

        {/* 상세 보기 */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#E5E8EB] py-2.5 text-[12.5px] font-semibold text-[#4E5968] hover:bg-[#F9FAFB]"
        >
          <TrendingUp className="w-4 h-4" style={{ color: ACCENT }} />
          연도별 현금흐름 {open ? "접기" : "보기"}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E5E8EB]">
            <table className="w-full text-[12px] tabular-nums">
              <thead>
                <tr className="text-[#8B95A1] bg-[#F9FAFB]">
                  <th className="py-2 px-3 text-left font-medium">연차</th>
                  <th className="py-2 px-3 text-right font-medium">매출</th>
                  <th className="py-2 px-3 text-right font-medium">로열티</th>
                  <th className="py-2 px-3 text-right font-medium">세후</th>
                  <th className="py-2 px-3 text-right font-medium">현가</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.year} className="border-t border-[#F2F4F6]">
                    <td className="py-2 px-3 text-[#191F28]">{row.year}년</td>
                    <td className="py-2 px-3 text-right text-[#8B95A1]">{row.revenue > 0 ? formatNumber(row.revenue) : "-"}</td>
                    <td className="py-2 px-3 text-right text-[#8B95A1]">{row.royalty > 0 ? formatNumber(row.royalty) : "-"}</td>
                    <td className="py-2 px-3 text-right text-[#8B95A1]">{row.afterTax > 0 ? formatNumber(row.afterTax) : "-"}</td>
                    <td className="py-2 px-3 text-right font-semibold text-[#191F28]">{row.discounted > 0 ? formatNumber(row.discounted) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 특허 품질 시그널 */}
        <div className="mt-3 rounded-2xl bg-[#F9FAFB] p-3.5">
          <p className="text-[11.5px] font-bold text-[#4E5968] mb-2">특허 정보 기반 보정 (계수 {result.patentQualityFactor.toFixed(2)})</p>
          <div className="flex flex-wrap gap-1.5">
            {result.patentSignals.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-lg bg-white border border-[#E5E8EB] px-2 py-1 text-[11px] text-[#4E5968]"
              >
                <span className="font-semibold">{s.label}</span>
                <span className="text-[#8B95A1]">{s.detail}</span>
              </span>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-[#8B95A1]">
          * 본 결과는 로열티공제법을 단순화한 <strong className="text-[#4E5968]">간이 추정값</strong>입니다 (법인세 22%, TCT 기준수명 {STAGE_META[stage].tctBase}년 적용).
          실제 기술이전·거래 금액 결정에는 전문 평가기관의 정밀평가가 필요합니다.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#E5E8EB] px-3 py-2.5">
      <p className="text-[11px] text-[#8B95A1] font-medium">{label}</p>
      <p className="text-[15px] font-bold text-[#191F28] tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-[#B0B8C1] mt-0.5 leading-tight">{hint}</p>}
    </div>
  );
}

function NumField({
  label, value, min, max, step, onChange,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11.5px] font-medium text-[#4E5968]">{label}</label>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="w-24 rounded-lg border border-[#E5E8EB] px-2 py-1 text-right text-[12.5px] font-semibold text-[#191F28] tabular-nums focus:outline-none focus:border-[#10B981]"
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#10B981]"
      />
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium text-[#4E5968] mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#E5E8EB] px-2 py-2 text-[12.5px] font-semibold text-[#191F28] bg-white focus:outline-none focus:border-[#10B981]"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
