import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HighlightRule {
  id: string;
  kind: "exclude" | "include";
  phrase: string;
}

/**
 * 승인된 하이라이트 규칙(제외/추가 문구)을 런타임에 로드한다.
 * 익명 RLS 정책으로 누구나 status='approved' 행을 읽을 수 있다.
 */
export function useHighlightRules() {
  return useQuery({
    queryKey: ["highlight-rules"],
    queryFn: async (): Promise<HighlightRule[]> => {
      const { data, error } = await supabase
        .from("highlight_rule_proposals")
        .select("id, kind, phrase")
        .eq("status", "approved")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as HighlightRule[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}