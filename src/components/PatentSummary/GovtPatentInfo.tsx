import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GovtPatentData {
  institution?: string;
  chargeType?: string;
  evaluationGrade?: string;
  durationUntil?: string;
  ipType?: string;
}

/** KIPRIS 국유특허 기본조회 기반 유·무상 실시 구분 표시 */
export function GovtPatentInfo({ registrationNumber }: { registrationNumber?: string }) {
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

  if (!data) return null;

  const free = (data.chargeType || "").includes("무상");

  return (
    <div className="mt-2 border-t border-dashed border-[#E5E8EB] px-4 sm:px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F2F4F6] px-2 py-1 text-[11px] font-semibold text-[#4E5968]">
          <BadgeCheck className="h-3.5 w-3.5" />
          국유특허
        </span>
        <span
          className={`pdf-shape-center inline-flex items-center rounded-[4px] px-2 py-1 text-[11px] font-bold ${
            free ? "bg-[#E7F7F0] text-[#0B7A55]" : "bg-[#FFF3E5] text-[#B25E00]"
          }`}
        >
          실시 구분 · {data.chargeType || "미표기"}
        </span>
        {data.institution && (
          <span className="text-[12px] text-[#8B95A1]">
            관리기관 {data.institution}
          </span>
        )}
        {data.durationUntil && (
          <span className="text-[12px] text-[#8B95A1] tabular-nums">
            존속기간 만료 {data.durationUntil}
          </span>
        )}
        {data.evaluationGrade && (
          <span className="text-[12px] text-[#8B95A1]">등급 {data.evaluationGrade}</span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-[#B0B8C1]">출처: KIPRIS 국유특허 기본조회</p>
    </div>
  );
}
