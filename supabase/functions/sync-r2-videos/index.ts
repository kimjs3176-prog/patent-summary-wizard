// Syncs the 온라인 기술 홍보관 video list (site_settings.tech_videos) with the R2 bucket.
// New .mp4/.webm files are appended (title from file name, category from a leading "[분류]"),
// files removed from the bucket are dropped, and admin-edited titles/categories are kept.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const ACCOUNT_ID = "766285132f8dac5b41c1f8ece436f600";
const BUCKET = "techvideo";
const PUBLIC_BASE = "https://pub-96cddd86429b42fdbdbd867498efaa4f.r2.dev";
const VIDEO_RE = /\.(mp4|webm|m4v|mov)$/i;

type Video = { url: string; title: string; category?: string; [k: string]: unknown };

export function publicUrl(key: string) {
  return `${PUBLIC_BASE}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function titleFromKey(key: string): { title: string; category?: string } {
  let name = key.split("/").pop()!.replace(VIDEO_RE, "");
  let category: string | undefined;
  const m = name.match(/^\s*\[([^\]]+)\]\s*/);
  if (m) { category = m[1].trim(); name = name.slice(m[0].length); }
  name = name
    .replace(/^\s*\d+\s*[.)_-]\s*/, "")
    .replace(/기술\s*소개\s*영상\s*[_-]?\s*/g, "")
    .replace(/[_\s-]*(v\s*F|v\d+(\.\d+)*|final|최종|\d+회차?|\d{3,4}\s*[x×]\s*\d{3,4}|\d{3,4}p)\s*$/gi, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: name || key, category };
}

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

    const bucketUrls = new Map(keys.map((k) => [publicUrl(k), k]));
    const kept = current.filter((v) => !v.url?.startsWith(PUBLIC_BASE) || bucketUrls.has(v.url));
    const known = new Set(kept.map((v) => v.url));
    const added: Video[] = [];
    for (const [url, key] of bucketUrls) {
      if (known.has(url)) continue;
      const { title, category } = titleFromKey(key);
      added.push({ url, title, category: category ?? "기타" });
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
