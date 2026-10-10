import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { resolveKiprisKey, kiprisFetchText, xmlTag } from "../_shared/kipris.ts";
import { aggregateFilings, filingPeriod, type TechnologyStats } from "../_shared/technologyFields.ts";

const CACHE_KEY = "technology_field_stats_v1";
const ORGANIZATIONS = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원", "농업기술센터", "농업기술원"];
let refreshing: Promise<TechnologyStats> | null = null;

async function refresh(): Promise<TechnologyStats> {
  const key = await resolveKiprisKey();
  if (!key) throw new Error("KIPRIS unavailable");
  const { start, end } = filingPeriod(new Date());
  const batches = await Promise.all(ORGANIZATIONS.map(async applicant => {
    const items: { number: string; applicant: string; ipc: string; date: string }[] = [];
    let total = Infinity;
    for (let page = 1; (page - 1) * 500 < total; page++) {
      const url = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
      for (const [name, value] of Object.entries({ ServiceKey: key, applicant, applicationDate: `${start}~${end}`, patent: "true", utility: "true", pageNo: String(page), numOfRows: "500", sortSpec: "AD", descSort: "true" })) url.searchParams.set(name, value);
      const xml = await kiprisFetchText(url.toString());
      const count = xmlTag(xml, "totalCount");
      if (xmlTag(xml, "successYN") === "N" || !/^\d+$/.test(count)) throw new Error("Incomplete KIPRIS statistics");
      total = Number(count);
      const rows = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      if (!rows.length && (page - 1) * 500 < total) throw new Error("Missing KIPRIS page");
      for (const [, row] of rows) items.push({ number: xmlTag(row, "applicationNumber"), applicant: xmlTag(row, "applicantName"), ipc: xmlTag(row, "ipcNumber"), date: xmlTag(row, "applicationDate") });
    }
    return items;
  }));
  const fields = aggregateFilings(batches.flat(), start, end);
  const result = { fields, total: fields.reduce((sum, field) => sum + field.count, 0), start, end, updatedAt: new Date().toISOString() };
  const { error } = await supabaseAdmin().from("site_settings").upsert({ key: CACHE_KEY, value: JSON.stringify(result), updated_at: result.updatedAt }, { onConflict: "key" });
  if (error) console.warn("Statistics cache save failed");
  return result;
}

Deno.serve(async req => {
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return respond({ error: "Method not allowed" }, 405);
  const limited = await enforceRateLimit(req, { bucket: "technology-field-stats", limit: 60, windowSeconds: 300 });
  if (limited) return limited;
  const { data } = await supabaseAdmin().from("site_settings").select("value").eq("key", CACHE_KEY).maybeSingle();
  let cached: TechnologyStats | null = null;
  try { cached = data?.value ? JSON.parse(data.value) : null; } catch { /* refresh invalid cache */ }
  if (cached && Date.now() - Date.parse(cached.updatedAt) < 86400000) return respond({ success: true, ...cached });
  if (!refreshing) refreshing = refresh().finally(() => { refreshing = null; });
  if (cached) {
    // Serve the last complete snapshot while refreshing; never publish partial counts.
    EdgeRuntime.waitUntil(refreshing.catch(() => {}));
    return respond({ success: true, ...cached, stale: true });
  }
  try { return respond({ success: true, ...await refreshing }); }
  catch { return respond({ success: false, error: "출원 통계를 불러오지 못했습니다." }, 503); }
});