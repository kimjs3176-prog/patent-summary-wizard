import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
