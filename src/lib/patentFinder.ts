import { supabase } from "@/integrations/supabase/client";

export const FINDER_INDUSTRIES = [
  "식품가공", "건강기능식품", "농자재·비료", "스마트팜", "종자·육묘",
  "축산·사료", "화장품·바이오소재", "농기계·장비", "유통·포장",
];

export const FINDER_PURPOSES = ["신제품 개발", "공정 개선", "원가 절감", "품질 향상", "신사업 진출", "인증·규제 대응"] as const;
export type FinderPurpose = typeof FINDER_PURPOSES[number];

export const FINDER_CAPABILITY_CHIPS = ["생산 설비 보유", "연구 인력 보유", "시험·분석 장비", "원료 재배·조달", "위탁 생산(OEM)", "판매 유통망"];

export type FinderReadiness = "ready" | "improve" | "codevelop" | "any";
export const FINDER_READINESS: { value: FinderReadiness; label: string; hint: string }[] = [
  { value: "ready", label: "바로 적용", hint: "TRL 7~9" },
  { value: "improve", label: "보완 후 적용", hint: "TRL 4~6" },
  { value: "codevelop", label: "공동 개발", hint: "TRL 1~3" },
  { value: "any", label: "상관없음", hint: "전체" },
];

export interface FinderForm {
  industry: string;
  item: string;
  purposes: FinderPurpose[];
  capabilities: string;
  readiness: FinderReadiness;
}

export interface FinderResult {
  patentId: string;
  title: string;
  applicant?: string;
  applicationDate?: string;
  publicationDate?: string;
  snippet?: string;
  ipc?: string;
  terms: string[];
  trl?: number | null;
  fit: number;
  reason: string;
  matchPoints: string[];
  considerations: string;
  readinessMatch: boolean | null;
}

export interface FinderResponse {
  success: boolean;
  error?: string;
  terms?: string[];
  need?: string;
  candidateCount?: number;
  results?: FinderResult[];
}

export const EMPTY_FINDER_FORM: FinderForm = { industry: "", item: "", purposes: [], capabilities: "", readiness: "any" };

export function fitBand(fit: number): { label: string; tone: "high" | "mid" | "low" } {
  if (fit >= 80) return { label: "매우 적합", tone: "high" };
  if (fit >= 65) return { label: "적합", tone: "mid" };
  return { label: "검토 가능", tone: "low" };
}

export async function findMyPatents(form: FinderForm): Promise<FinderResponse> {
  const { data, error } = await supabase.functions.invoke("find-my-patents", { body: form });
  if (error) {
    // Edge errors carry the JSON body in context; surface our Korean message when present.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) return { success: false, error: body.error };
      } catch { /* ignore */ }
    }
    return { success: false, error: "추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return data as FinderResponse;
}
