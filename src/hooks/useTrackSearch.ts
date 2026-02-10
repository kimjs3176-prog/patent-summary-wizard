import { supabase } from "@/integrations/supabase/client";

export async function trackPatentSearch(patentNumber: string, patentTitle?: string) {
  try {
    await supabase.rpc("upsert_search_stat", {
      p_patent_number: patentNumber,
      p_patent_title: patentTitle || null,
    });
  } catch (error) {
    console.error("Failed to track search:", error);
  }
}
