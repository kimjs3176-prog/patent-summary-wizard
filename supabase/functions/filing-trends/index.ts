import { generateChatCompletion, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.11";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { resolveKiprisKey, kiprisFetchText, xmlTag } from "../_shared/kipris.ts";
import { TECHNOLOGY_FIELDS } from "../_shared/technologyFields.ts";
import { aggregateTrends, growthRate, trendPeriod, verifiedInsights, type RawFiling, type TrendReport } from "./trendAggregation.ts";

// Bump when aggregation or classification changes so obsolete snapshots are never served.
const CACHE_KEY = "filing_trends_v1";
const ORGANIZATIONS = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원", "농업기술센터", "농업기술원"];
type Snapshot = TrendReport & { insights: string[]; updatedAt: string };
let refreshing: Promise<Snapshot> | null = null;

async function fetchFilings(key: string, start: string, end: string): Promise<RawFiling[]> {
  const batches = await Promise.all(ORGANIZATIONS.map(async (applicant) => {
    const items: RawFiling[] = [];
    let total = Infinity;
    for (let page = 1; (page - 1) * 500 < total; page++) {
      const url = new URL("https://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
      for (const [name, value] of Object.entries({ ServiceKey: key, applicant, applicationDate: `${start}~${end}`, patent: "true", utility: "true", pageNo: String(page), numOfRows: "500", sortSpec: "AD", descSort: "true" })) url.searchParams.set(name, value);
      const xml = await kiprisFetchText(url.toString(), { retries: 2, timeoutMs: 20000 });
      const count = xmlTag(xml, "totalCount");
      if (xmlTag(xml, "successYN") === "N" || !/^\d+$/.test(count)) throw new Error("Incomplete KIPRIS response");
      total = Number(count);
      const rows = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      if (!rows.length && (page - 1) * 500 < total) throw new Error("Missing KIPRIS page");
      for (const [, row] of rows) {
        items.push({
          number: xmlTag(row, "applicationNumber"),
          applicant: xmlTag(row, "applicantName"),
          ipc: xmlTag(row, "ipcNumber"),
          date: xmlTag(row, "applicationDate"),
          title: xmlTag(row, "inventionTitle"),
        });
      }
    }
    return items;
  }));
  return batches.flat();
}

const fieldLabel = (id: string) => TECHNOLOGY_FIELDS.find((f) => f.id === id)?.label ?? id;

async function summarize(report: TrendReport): Promise<string[]> {
  const y = report.completeYear;
  const latest = report.yearly.find((r) => r.year === y);
  const prev = report.yearly.find((r) => r.year === y - 1);
  const facts = {
    기준연도: y,
    기준연도_출원: latest?.count ?? 0,
    전년_출원: prev?.count ?? 0,
    전년대비_증감률: latest && prev ? growthRate(latest.count, prev.count) : null,
    연도별_출원: report.yearly.filter((r) => !r.provisional).map((r) => ({ 연도: r.year, 건수: r.count })),
    분야별: report.fields
      .filter((f) => f.latest + f.previous > 0)
      .sort((a, b) => b.latest - a.latest)
      .slice(0, 10)
      .map((f) => ({ 분야: fieldLabel(f.id), 기준연도: f.latest, 전년: f.previous, 증감률: f.growth, 비중: f.share })),
    기관별: report.institutes.map((i) => ({ 기관: i.label, 기준연도: i.latest, 전년: i.previous })),
  };
  try {
    const res = await generateChatCompletion({
      model: "google/gemini-3.8-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "당신은 농식품 분야 특허 동향 분석가입니다. 주어진 통계만 근거로 간결한 동향 요약을 씁니다. Return JSON only." },
        {
          role: "user",
          content: `[농업 국가연구기관 6곳 특허·실용신안 출원 통계]
${JSON.stringify(facts)}

규칙:
- insights: 3~4개 문장, 각 80자 이내, "~입니다/~했습니다"체.
- 증가·감소가 두드러진 분야, 비중이 큰 분야, 전체 흐름, 기관별 특징을 다룰 것.
- 숫자는 위 통계에 있는 값만 그대로 사용(새로 계산하거나 추정한 숫자 금지). 쉼표 없이 표기.
- 원인이나 전망을 단정하지 말 것.
형식: {"insights":["..."]}`,
        },
      ],
    });
    const content = res.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "") : "";
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return verifiedInsights(parsed.insights, report);
  } catch (e) {
    console.warn("[filing-trends] summary skipped", e instanceof GatewayError ? e.code : e);
    return [];
  }
}

async function refresh(): Promise<Snapshot> {
  const key = await resolveKiprisKey();
  if (!key) throw new Error("KIPRIS unavailable");
  const now = new Date();
  const { start, end } = trendPeriod(now);
  const report = aggregateTrends(await fetchFilings(key, start, end), now);
  if (report.total === 0) throw new Error("Empty trend data");
  const snapshot: Snapshot = { ...report, insights: await summarize(report), updatedAt: now.toISOString() };
  const { error } = await supabaseAdmin().from("site_settings").upsert({ key: CACHE_KEY, value: JSON.stringify(snapshot), updated_at: snapshot.updatedAt }, { onConflict: "key" });
  if (error) console.warn("[filing-trends] cache save failed");
  return snapshot;
}

Deno.serve(async (req) => {
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return respond({ error: "Method not allowed" }, 405);
  const limited = await enforceRateLimit(req, { bucket: "filing-trends", limit: 60, windowSeconds: 300 });
  if (limited) return limited;

  const { data } = await supabaseAdmin().from("site_settings").select("value").eq("key", CACHE_KEY).maybeSingle();
  let cached: Snapshot | null = null;
  try { cached = data?.value ? JSON.parse(data.value) : null; } catch { /* refresh invalid cache */ }
  if (cached && Date.now() - Date.parse(cached.updatedAt) < 86_400_000) return respond({ success: true, ...cached });

  if (!refreshing) refreshing = refresh().finally(() => { refreshing = null; });
  if (cached) {
    // Serve the last complete snapshot while refreshing; partial data is never published.
    EdgeRuntime.waitUntil(refreshing.catch(() => {}));
    return respond({ success: true, ...cached, stale: true });
  }
  try { return respond({ success: true, ...(await refreshing) }); }
  catch (e) {
    console.error("[filing-trends] refresh failed", e instanceof Error ? e.message : e);
    return respond({ success: false, error: "출원 동향을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
  }
});
