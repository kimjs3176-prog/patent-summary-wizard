import { fetchWithRetry } from "./http.ts";

/** Shared KIPRIS access helpers (key lookup, guarded fetch, XML tag extraction). */

export function kiprisApiKey(): string {
  const key = Deno.env.get("KIPRIS_API_KEY");
  if (!key) throw new Error("KIPRIS_API_KEY is not configured");
  return key;
}

/** Fetch a KIPRIS endpoint as text with timeout + retry. */
export async function kiprisFetchText(
  url: string,
  { retries = 2, timeoutMs = 12000 } = {},
): Promise<string> {
  const res = await fetchWithRetry(url, {}, { retries, timeoutMs });
  if (!res.ok) throw new Error(`KIPRIS request failed: HTTP ${res.status}`);
  return await res.text();
}

/** First value of an XML tag. */
export function xmlTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeXml(m[1].trim()) : "";
}

/** All values of a repeated XML tag. */
export function xmlTagAll(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(decodeXml(m[1].trim()));
  return out;
}

export function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Resolve the KIPRIS key: admin-managed value in site_settings wins, env is the fallback.
 * Previously duplicated in 5 edge functions.
 */
export async function resolveKiprisKey(): Promise<string | undefined> {
  let key = Deno.env.get("KIPRIS_API_KEY") ?? undefined;
  try {
    const { supabaseAdmin } = await import("./supabaseAdmin.ts");
    const { data: row } = await supabaseAdmin()
      .from("site_settings")
      .select("value")
      .eq("key", "kipris_api_key")
      .maybeSingle();
    if (row?.value) key = row.value as string;
  } catch {
    // keep env fallback
  }
  return key;
}
