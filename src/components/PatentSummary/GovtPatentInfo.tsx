import { useEffect, useState } from "react";
import { BadgeCheck, Gift, Coins, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface GovtPatentData {
  institution?: string;
  chargeType?: string;
  evaluationGrade?: string;
  durationUntil?: string;
  ipType?: string;
}

/** KIPRIS 국유특허 기본조회 데이터 훅 */
export function useGovtPatent(registrationNumber?: string) {
  const [data, setData] = useState<GovtPatentData | null>(null);

  useEffect(() => {
    let alive = true;
    if (!registrationNumber) {
      setData(null);
      return;
    }
    (async () => {
      try {
        const { data: res, error } = await supabase.functions.invoke("govt-patent", {
          body: { registrationNumber },
        });
        if (error || !alive) return;
        if (res?.success && res?.found) setData(res.data as GovtPatentData);
        else setData(null);
      } catch {
        /* 조회 실패 시 표시하지 않음 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [registrationNumber]);

  return data;
}

/** 국유특허 · 유무상 실시 구분 강조 뱃지 (상단 노출용) */
// 유무상 실시 여부 표시 — 우선 숨김 (다시 노출하려면 true로 변경)
const SHOW_CHARGE_BADGE = false;

export function GovtPatentBadges({ data }: { data: GovtPatentData | null }) {
  if (!data) return null;

  const charge = data.chargeType || "";
  const free = charge.includes("무상");
  const paid = charge.includes("유상");

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <span className="pdf-shape-center inline-flex items-center gap-1.5 rounded-full border border-[#0B7A55]/25 bg-[#E7F7F0] px-3 py-1.5 text-[12.5px] font-bold text-[#0B7A55]">
        <BadgeCheck className="h-4 w-4" />
        국유특허
      </span>
      {SHOW_CHARGE_BADGE && (free || paid) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`pdf-shape-center inline-flex cursor-help items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold text-white shadow-sm ${
                free ? "bg-[#0B7A55]" : "bg-[#B25E00]"
              }`}
            >
              {free ? <Gift className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
              {free ? "무상 실시 가능" : "유상 실시"}
              <HelpCircle className="h-3.5 w-3.5 opacity-80" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-[12px] leading-relaxed">
            {free
              ? "무상 실시: 별도의 실시료 없이 기술을 활용할 수 있습니다."
              : "유상 실시: 실시료는 해당 기술로 발생한 매출액의 최대 3% 이내에서 정해집니다."}
          </TooltipContent>
        </Tooltip>
      )}
      {SHOW_CHARGE_BADGE && paid && (
        <span className="text-[12px] font-medium text-[#B25E00]">실시료 매출액의 최대 3% 이내</span>
      )}
      {SHOW_CHARGE_BADGE && !free && !paid && charge && (
        <span className="pdf-shape-center inline-flex items-center rounded-full bg-[#F2F4F6] px-3 py-1.5 text-[12.5px] font-bold text-[#4E5968]">
          실시 구분 · {charge}
        </span>
      )}
      {data.institution && (
        <span className="text-[12px] text-[#8B95A1]">관리기관 {data.institution}</span>
      )}
      {data.evaluationGrade && (
        <span className="text-[12px] text-[#8B95A1]">평가등급 {data.evaluationGrade}</span>
      )}
      <span className="text-[11px] text-[#B0B8C1]">출처: KIPRIS 국유특허 기본조회</span>
    </div>
  );
}
