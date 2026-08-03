// 기술가치 간이평가 — 로열티공제법(Royalty Relief), V-RAY 모델(ver1.4.4) 기준 단순화
//
// 가치 = NPV[ 매출 × 합리적로열티율 × 지식재산보호비중 × (1-세율) ] × 지식재산 유효성
//   - 합리적로열티율 = 기준로열티율 × 조정계수2
//   - 할인율 = WACC + 사업화 위험프리미엄 + 성숙도 위험프리미엄
//   - 유효경제수명 = TCT기준수명 × (1 + 영향요인평점/20), 법적잔존권리기간(20년-출원경과) cap
//   - 현금흐름추정기간 = 유효경제수명 + 사업화 소요기간

export type Stage = "기초연구" | "실험" | "시제품" | "실용화" | "양산";
export type Grade = "A" | "B" | "C" | "D" | "E";
export type Scenario = "optimistic" | "base" | "pessimistic";

export type PatentMeta = {
  registerStatus?: string;
  registerNumber?: string;
  ipcNumber?: string;
  applicationDate?: string; // YYYYMMDD or YYYY-MM-DD
  registerDate?: string;
  abstract?: string;
  applicantName?: string;
};

export type ValuationInput = {
  initialRevenueMM: number;
  growthRate: number;
  stage: Stage;
  techGrade: Grade;
  marketGrade: Grade;
  rightsGrade: Grade;
  royaltyRate?: number;
  scenario?: Scenario;
  patent?: PatentMeta | null;
  /** 지식재산 보호비중 (기술비중) 0~1, 기본 0.6 */
  techShare?: number;
  /** 산업기술요소 0~1, 기본 0.5 (농식품 0.5075) */
  industryTechFactor?: number;
};

export type PatentQuality = {
  factor: number;
  signals: { label: string; delta: number; detail: string }[];
};

export function patentQuality(p?: PatentMeta | null): PatentQuality {
  const signals: PatentQuality["signals"] = [];
  if (!p) {
    return { factor: 1.0, signals: [{ label: "특허 정보 없음", delta: 0, detail: "기본값 적용" }] };
  }

  const status = (p.registerStatus ?? "").toString();
  const hasRegNum = !!p.registerNumber && p.registerNumber.length > 4;
  if (/등록/.test(status) || hasRegNum) {
    signals.push({ label: "등록특허", delta: +0.08, detail: "권리 확정 (+8%)" });
  } else if (/거절|소멸|포기|무효/.test(status)) {
    signals.push({ label: "권리 소멸/거절", delta: -0.15, detail: "보호력 상실 (−15%)" });
  } else if (/공개|출원|심사/.test(status)) {
    signals.push({ label: "출원·공개 단계", delta: -0.04, detail: "권리 미확정 (−4%)" });
  } else {
    signals.push({ label: "상태 미상", delta: 0, detail: "보정 없음" });
  }

  const ipcCount = p.ipcNumber
    ? p.ipcNumber.split(/[|;,\s]+/).filter((s) => s.trim().length >= 3).length
    : 0;
  if (ipcCount >= 3) {
    signals.push({ label: "융합기술 (IPC 3+)", delta: +0.04, detail: `IPC ${ipcCount}개 (+4%)` });
  } else if (ipcCount === 2) {
    signals.push({ label: "복합 IPC", delta: +0.02, detail: "IPC 2개 (+2%)" });
  } else if (ipcCount === 1) {
    signals.push({ label: "단일 IPC", delta: 0, detail: "IPC 1개" });
  } else {
    signals.push({ label: "IPC 정보 없음", delta: -0.02, detail: "분류 미확인 (−2%)" });
  }

  const appYear = p.applicationDate ? Number(p.applicationDate.replace(/\D/g, "").slice(0, 4)) : NaN;
  if (Number.isFinite(appYear) && appYear > 1900) {
    const age = new Date().getFullYear() - appYear;
    if (age <= 3) {
      signals.push({ label: "최근 출원", delta: +0.03, detail: `출원 ${age}년 경과 (+3%)` });
    } else if (age >= 15) {
      signals.push({ label: "노후 특허", delta: -0.06, detail: `출원 ${age}년 경과 (−6%)` });
    } else if (age >= 10) {
      signals.push({ label: "성숙 특허", delta: -0.02, detail: `출원 ${age}년 경과 (−2%)` });
    } else {
      signals.push({ label: "활성 구간", delta: 0, detail: `출원 ${age}년 경과` });
    }
  }

  const abLen = (p.abstract ?? "").length;
  if (abLen >= 300) {
    signals.push({ label: "충실한 명세서", delta: +0.02, detail: `요약 ${abLen}자 (+2%)` });
  } else if (abLen > 0 && abLen < 80) {
    signals.push({ label: "간략한 명세서", delta: -0.02, detail: `요약 ${abLen}자 (−2%)` });
  }

  const sum = signals.reduce((a, s) => a + s.delta, 0);
  const factor = Math.max(0.85, Math.min(1.15, 1 + sum));
  return { factor, signals };
}

export const SCENARIO_META: Record<
  Scenario,
  { label: string; revMul: number; growthAdj: number; emoji: string; desc: string }
> = {
  optimistic: { label: "낙관", revMul: 1.2, growthAdj: 0.03, emoji: "📈", desc: "시장 빠르게 확대" },
  base: { label: "보통", revMul: 1.0, growthAdj: 0, emoji: "📊", desc: "예상대로 성장" },
  pessimistic: { label: "비관", revMul: 0.75, growthAdj: -0.03, emoji: "📉", desc: "경쟁/지연 발생" },
};

export const STAGE_META: Record<
  Stage,
  { lead: number; tctBase: number; maturityPremium: number; immaturePremium: number }
> = {
  기초연구: { lead: 4, tctBase: 7, maturityPremium: 0.10, immaturePremium: 0.328 },
  실험: { lead: 3, tctBase: 7, maturityPremium: 0.06, immaturePremium: 0.241 },
  시제품: { lead: 2, tctBase: 8, maturityPremium: 0.04, immaturePremium: 0.153 },
  실용화: { lead: 1, tctBase: 9, maturityPremium: 0.02, immaturePremium: 0.066 },
  양산: { lead: 0, tctBase: 10, maturityPremium: 0.00, immaturePremium: 0.00 },
};

const GRADE_SCORE: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };

function riskPremiumFromScore(totalScore10Items: number): number {
  const s = Math.max(20, Math.min(50, totalScore10Items));
  const t = (50 - s) / 30;
  return 0.0006 + (0.1877 - 0.0006) * t;
}

function ipValidity(rightsScore: number, techScore: number): number {
  const avg = rightsScore * 0.7 + techScore * 0.3;
  return 0.5 + ((avg - 1) / 4) * 0.5;
}

function royaltyAdjustmentFactor(avgScore: number): number {
  return Math.max(0.5, Math.min(1.5, 0.25 * avgScore + 0.25));
}

function effectiveLife(stage: Stage, avgScore: number, patent?: PatentMeta | null) {
  const meta = STAGE_META[stage];
  const factorScore = (avgScore - 3) * 10;
  const adjusted = meta.tctBase * (1 + factorScore / 20);

  let legalCap = 20;
  const ay = patent?.applicationDate ? Number(patent.applicationDate.replace(/\D/g, "").slice(0, 4)) : NaN;
  if (Number.isFinite(ay) && ay > 1900) {
    const age = new Date().getFullYear() - ay;
    legalCap = Math.max(1, 20 - age);
  }
  const effective = Math.max(1, Math.min(adjusted, legalCap));
  return { base: meta.tctBase, adjusted, legalCap, effective };
}

const DEFAULT_ROYALTY = 0.03;
const TAX_RATE = 0.22;
const BASE_WACC = 0.1077;
const DEFAULT_TECH_SHARE = 0.6;
const DEFAULT_INDUSTRY_TECH_FACTOR = 0.5075; // 농식품 산업기술요소

export type CashflowRow = {
  year: number;
  revenue: number;
  royalty: number;
  afterTax: number;
  discounted: number;
};

export type ValuationResult = {
  rows: CashflowRow[];
  totalNPV: number;
  npvBeforeValidity: number;
  discountRate: number;
  wacc: number;
  riskPremium: number;
  maturityPremium: number;
  ipValidity: number;
  patentQualityFactor: number;
  effectiveValidity: number;
  patentSignals: PatentQuality["signals"];
  royaltyRate: number;
  royaltyAdjFactor: number;
  effectiveRoyaltyRate: number;
  techShare: number;
  industryTechFactor: number;
  techContribution: number;
  individualTechStrength: number;
  effectiveLifeYears: number;
  effectiveLifeBase: number;
  legalLifeCap: number;
  cashflowYears: number;
  leadTimeYears: number;
  formattedTotal: string;
  scenario: Scenario;
  scenarioRange: { optimistic: number; base: number; pessimistic: number };
};

function computeScenario(input: ValuationInput, scenario: Scenario, qualityFactor: number) {
  const meta = STAGE_META[input.stage];
  const baseRoyalty = input.royaltyRate ?? DEFAULT_ROYALTY;
  const sm = SCENARIO_META[scenario];

  const techScore = GRADE_SCORE[input.techGrade];
  const marketScore = GRADE_SCORE[input.marketGrade];
  const rightsScore = GRADE_SCORE[input.rightsGrade];
  const avgScore = (techScore + marketScore + rightsScore) / 3;

  const totalScore10 = avgScore * 10;
  const rp = riskPremiumFromScore(totalScore10);
  const mp = meta.maturityPremium;
  const discountRate = BASE_WACC + rp + mp;

  const validity = ipValidity(rightsScore, techScore);
  const effValidity = Math.min(1.0, Math.max(0.3, validity * qualityFactor));

  const adjFactor = royaltyAdjustmentFactor(avgScore);
  const effRoyalty = baseRoyalty * adjFactor;

  const techShare = Math.max(0, Math.min(1, input.techShare ?? DEFAULT_TECH_SHARE));

  const life = effectiveLife(input.stage, avgScore, input.patent);
  const cashflowYears = Math.ceil(life.effective + meta.lead);

  const initRev = input.initialRevenueMM * sm.revMul;
  const growth = Math.max(-0.1, input.growthRate + sm.growthAdj);

  const rows: CashflowRow[] = [];
  let cfNPV = 0;
  for (let y = 1; y <= cashflowYears; y++) {
    const inSales = y > meta.lead;
    const yearsSelling = inSales ? y - meta.lead - 1 : 0;
    const revenue = inSales ? initRev * Math.pow(1 + growth, yearsSelling) : 0;
    const royaltyCF = revenue * effRoyalty * techShare;
    const afterTax = royaltyCF * (1 - TAX_RATE);
    const discounted = afterTax / Math.pow(1 + discountRate, y);
    cfNPV += discounted;
    rows.push({ year: y, revenue, royalty: royaltyCF, afterTax, discounted });
  }
  const total = cfNPV * effValidity;
  return {
    rows, total, cfNPV, discountRate, rp, mp, validity, effValidity,
    baseRoyalty, adjFactor, effRoyalty, techShare, life, cashflowYears, meta,
    avgScore, techScore, marketScore, rightsScore,
  };
}

export function calculate(input: ValuationInput): ValuationResult {
  const scenario: Scenario = input.scenario ?? "base";
  const quality = patentQuality(input.patent);
  const main = computeScenario(input, scenario, quality.factor);
  const opt = computeScenario(input, "optimistic", quality.factor).total;
  const base = computeScenario(input, "base", quality.factor).total;
  const pes = computeScenario(input, "pessimistic", quality.factor).total;

  const indFactor = Math.max(0, Math.min(1, input.industryTechFactor ?? DEFAULT_INDUSTRY_TECH_FACTOR));
  const techStrengthTech = ((main.techScore + main.rightsScore) / 2) * 10;
  const techStrengthBiz = main.marketScore * 10;
  const individualStrength = (techStrengthTech / 50 + techStrengthBiz / 50) / 2;
  const techContribution = indFactor * main.techShare * individualStrength;

  return {
    rows: main.rows,
    totalNPV: main.total,
    npvBeforeValidity: main.cfNPV,
    discountRate: main.discountRate,
    wacc: BASE_WACC,
    riskPremium: main.rp,
    maturityPremium: main.mp,
    ipValidity: main.validity,
    patentQualityFactor: quality.factor,
    effectiveValidity: main.effValidity,
    patentSignals: quality.signals,
    royaltyRate: main.baseRoyalty,
    royaltyAdjFactor: main.adjFactor,
    effectiveRoyaltyRate: main.effRoyalty,
    techShare: main.techShare,
    industryTechFactor: indFactor,
    techContribution,
    individualTechStrength: individualStrength,
    effectiveLifeYears: Math.round(main.life.effective * 10) / 10,
    effectiveLifeBase: main.life.base,
    legalLifeCap: Math.round(main.life.legalCap * 10) / 10,
    cashflowYears: main.cashflowYears,
    leadTimeYears: main.meta.lead,
    formattedTotal: formatKRW(main.total),
    scenario,
    scenarioRange: { optimistic: opt, base, pessimistic: pes },
  };
}

/** AI 점수(0~100) → 등급 */
export function scoreToGrade(score?: number | null): Grade {
  const s = score ?? 60;
  if (s >= 85) return "A";
  if (s >= 75) return "B";
  if (s >= 65) return "C";
  if (s >= 55) return "D";
  return "E";
}

/** TRL(1~9) → 개발단계 */
export function trlToStage(trl?: number | null): Stage {
  if (trl == null) return "시제품";
  if (trl <= 2) return "기초연구";
  if (trl <= 4) return "실험";
  if (trl <= 6) return "시제품";
  if (trl <= 8) return "실용화";
  return "양산";
}

export function formatKRW(mm: number): string {
  if (mm >= 100000) return `${(mm / 10000).toFixed(1)}조 원`;
  if (mm >= 10000) return `${(mm / 10000).toFixed(2)}조 원`;
  if (mm >= 100) return `${(mm / 100).toFixed(1)}억 원`;
  return `${mm.toFixed(1)}백만 원`;
}

export function formatNumber(mm: number): string {
  return mm.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}
