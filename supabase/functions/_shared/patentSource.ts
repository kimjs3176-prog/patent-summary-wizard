import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Server-side source of truth for patent originals.
 *
 * Summaries and scores are stored in caches that every visitor reads, so the
 * text they are generated from must never come from the request body: an
 * anonymous caller could otherwise attach a fabricated abstract to a real
 * patent number and poison what everyone sees afterwards. Both analysis
 * functions therefore load the KIPRIS record that fetch-patent stored in
 * patent_data_cache, and populate it through fetch-patent when it is missing.
 */

/** Headers that let the internal fetch-patent call be rate-limited as the original caller. */
function forwardedClientHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const v = req.headers.get(name);
    if (v) out[name] = v;
  }
  return out;
}

export async function loadServerPatentData(req: Request, patentNumber: string): Promise<Record<string, unknown> | null> {
  try {
    const { data: row } = await supabaseAdmin()
      .from("patent_data_cache")
      .select("patent_data")
      .eq("patent_number", patentNumber)
      .maybeSingle();
    if (row?.patent_data && typeof row.patent_data === "object") {
      return row.patent_data as Record<string, unknown>;
    }
  } catch (e) {
    console.warn(`[patentSource] cache read failed for ${patentNumber}:`, e instanceof Error ? e.message : String(e));
  }

  // Not cached yet (or expired and refreshed by another path): let fetch-patent populate it.
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/functions/v1/fetch-patent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...forwardedClientHeaders(req),
      },
      body: JSON.stringify({ patentNumber }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json.data && typeof json.data === "object") {
      return json.data as Record<string, unknown>;
    }
    console.warn(`[patentSource] fetch-patent returned ${res.status} for ${patentNumber}`);
  } catch (e) {
    console.warn(`[patentSource] fetch-patent call failed for ${patentNumber}:`, e instanceof Error ? e.message : String(e));
  }
  return null;
}

/** Latest server-generated summary for a patent (empty string when none is cached yet). */
export async function loadServerSummary(patentNumber: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin()
      .from("patent_ai_cache")
      .select("summary_content, created_at")
      .eq("patent_number", patentNumber)
      .like("analysis_mode", "detailed_%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return typeof data?.summary_content === "string" ? data.summary_content : "";
  } catch (e) {
    console.warn(`[patentSource] summary read failed for ${patentNumber}:`, e instanceof Error ? e.message : String(e));
    return "";
  }
}
