// Syncs the 온라인 기술 홍보관 video list (site_settings.tech_videos) with the R2 bucket.
// New .mp4/.webm files are appended (title from file name, category from a leading "[분류]"),
// files removed from the bucket are dropped, and admin-edited titles/categories are kept.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { keyFromUrl, publicUrl, titleFromKey, VIDEO_RE } from "./videoKeys.ts";

const ACCOUNT_ID = "766285132f8dac5b41c1f8ece436f600";
const BUCKET = "techvideo";
const PUBLIC_BASE = "https://pub-96cddd86429b42fdbdbd867498efaa4f.r2.dev";

type Video = { url: string; title: string; category?: string; [k: string]: unknown };

async function listKeys(aws: AwsClient): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const u = new URL(`https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}`);
    u.searchParams.set("list-type", "2");
    if (token) u.searchParams.set("continuation-token", token);
    const res = await aws.fetch(u.toString());
    const xml = await res.text();
    if (!res.ok) throw new Error(`R2 목록 조회 실패 (${res.status})`);
    for (const m of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
      keys.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] : undefined;
  } while (token);
  return keys.filter((k) => VIDEO_RE.test(k));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    if (!accessKeyId || !secretAccessKey) return json({ error: "R2 접근 키가 설정되지 않았습니다." }, 500);
    const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const keys = await listKeys(aws);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await db.from("site_settings").select("value").eq("key", "tech_videos").maybeSingle();
    let current: Video[] = [];
    try { const p = JSON.parse(data?.value || "[]"); if (Array.isArray(p)) current = p; } catch { /* keep empty */ }

    // An empty listing is treated as a glitch, never as "delete every video".
    if (keys.length === 0) return json({ total: current.length, added: [], removed: 0, skipped: "빈 목록" });
    const bucketKeys = new Set(keys.map((k) => k.normalize("NFC")));
    const kept = current.filter((v) => {
      const k = keyFromUrl(PUBLIC_BASE, v.url);
      return k === null || bucketKeys.has(k);
    });
    const known = new Set(kept.map((v) => keyFromUrl(PUBLIC_BASE, v.url)).filter(Boolean));
    const added: Video[] = [];
    for (const key of keys) {
      if (known.has(key.normalize("NFC"))) continue;
      const { title, category } = titleFromKey(key);
      added.push({ url: publicUrl(PUBLIC_BASE, key), title, category: category ?? "기타" });
    }
    const removed = current.length - kept.length;
    if (added.length || removed) {
      const { error } = await db.from("site_settings").upsert(
        { key: "tech_videos", value: JSON.stringify([...kept, ...added]), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (error) throw error;
    }
    return json({ total: kept.length + added.length, added: added.map((a) => a.title), removed });
  } catch (e) {
    console.error("[sync-r2-videos]", e);
    return json({ error: e instanceof Error ? e.message : "동기화 실패" }, 500);
  }
});
