import { fetchWithRetry } from "./http.ts";

/** Shared KIPRIS access helpers (key lookup, guarded fetch, XML tag extraction). */

/** KIPRIS Plus must be called over TLS: the service key travels in the query string. */
export const KIPRIS_PLUS_ORIGIN = "https://plus.kipris.or.kr";
export const KIPRIS_PATENT_SEARCH_URL = `${KIPRIS_PLUS_ORIGIN}/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch`;
export const KIPRIS_PATENT_DETAIL_URL = `${KIPRIS_PLUS_ORIGIN}/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch`;

/**
 * site_settings keys that must never be readable by the public client nor
 * editable through the admin settings form. Secrets live in function secrets.
 */
export const SECRET_SETTING_KEYS = new Set(["kipris_api_key"]);
export const isSecretSettingKey = (key: string) =>
  SECRET_SETTING_KEYS.has(key) || /api_key|secret|password/i.test(key);

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
 * Resolve the KIPRIS key: the function secret (KIPRIS_API_KEY) is the source of
 * truth. A value stored in site_settings is only a temporary fallback for
 * deployments that have not set the secret yet; it is read with the service
 * role and is no longer exposed to the public client.
 */
export async function resolveKiprisKey(): Promise<string | undefined> {
  const envKey = Deno.env.get("KIPRIS_API_KEY") ?? undefined;
  if (envKey) return envKey;
  try {
    const { supabaseAdmin } = await import("./supabaseAdmin.ts");
    const { data: row } = await supabaseAdmin()
      .from("site_settings")
      .select("value")
      .eq("key", "kipris_api_key")
      .maybeSingle();
    if (row?.value) {
      console.warn("[kipris] using legacy site_settings key; set the KIPRIS_API_KEY function secret and remove the row");
      return row.value as string;
    }
  } catch {
    // no fallback available
  }
  return undefined;
}
