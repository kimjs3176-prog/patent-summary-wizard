import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RegisterOwner {
  name?: string;
  isFinal?: boolean;
  changeDate?: string;
}

export interface RegisterOwnerResult {
  /** 등록원부 기준 최종권리자 */
  finalOwner: string | null;
  loading: boolean;
}

const normalize = (s?: string | null) =>
  (s || "")
    .replace(/\(.*?\)/g, "")
    .replace(/[\s,·]/g, "")
    .toLowerCase();

/** 등록원부(공공데이터포털)에서 최종권리자를 조회한다. */
export function useRegisterOwner(registrationNumber?: string): RegisterOwnerResult {
  const [finalOwner, setFinalOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!registrationNumber) {
      setFinalOwner(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const { data: res, error } = await supabase.functions.invoke("patent-register", {
          body: { registrationNumber },
        });
        if (!alive) return;
        if (!error && res?.success && res?.found) {
          const owners: RegisterOwner[] = Array.isArray(res.data?.owners) ? res.data.owners : [];
          const last = owners.filter((o) => o.isFinal).pop() || owners[owners.length - 1];
          setFinalOwner(last?.name?.trim() || null);
        } else {
          setFinalOwner(null);
        }
      } catch {
        if (alive) setFinalOwner(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [registrationNumber]);

  return { finalOwner, loading };
}

/** 출원인과 최종권리자가 실질적으로 다른지 판단 */
export function isDifferentOwner(assignee?: string | null, finalOwner?: string | null): boolean {
  if (!finalOwner) return false;
  const a = normalize(assignee);
  const b = normalize(finalOwner);
  if (!b) return false;
  if (!a) return true;
  return !(a === b || a.includes(b) || b.includes(a));
}
