import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { KIPRIS_PATENT_DETAIL_URL, KIPRIS_PATENT_SEARCH_URL, kiprisFetchText, resolveKiprisKey, xmlTag, xmlTagAll } from "../_shared/kipris.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { CONSORTIUM_ORGS, normalizeApplicant, orgNames } from "../_shared/consortiumOrgs.ts";

/**
 * 식품기술이전 협의체: 기관 하나의 특허 목록.
 * 기관 이름으로 찾으면 이름이 비슷한 다른 기관(예: 건국대학교 / 건국대학교 글로컬) 특허가 섞이므로,
 * 먼저 출원인명으로 특허고객번호(출원인 코드)를 찾고 그 번호로만 목록을 받는다.
 * 찾은 번호는 site_settings.consortium_applicant_codes 에 90일 동안 저장해 다시 찾지 않는다.
 *
 * POST { org: 기관 이름, page?: 1 } → { success, org, codes, total, page, hasMore, items }
 */

const CACHE_KEY = "consortium_applicant_codes";
const CACHE_DAYS = 90;
const PAGE_SIZE = 20;
const CODE_RE = /^\d{12}$/;
// 권리가 남아 있지 않은 상태는 기술이전 대상이 아니므로 뺀다 (search-patents 와 같은 기준)
const EXCLUDED_STATUS = /(거절|소멸|취하|포기|무효)/;

type CodeCache = Record<string, { codes: string[]; at: string }>;

async function readCache(): Promise<CodeCache> {
  try {
    const { data } = await supabaseAdmin().from("site_settings").select("value").eq("key", CACHE_KEY).maybeSingle();
    const parsed = data?.value ? JSON.parse(data.value as string) : {};
    return parsed && typeof parsed === "object" ? parsed as CodeCache : {};
  } catch {
    return {};
  }
}

async function writeCache(cache: CodeCache): Promise<void> {
  try {
    await supabaseAdmin().from("site_settings").upsert({ key: CACHE_KEY, value: JSON.stringify(cache), updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch (e) {
    console.warn("[consortium-patents] cache write failed:", e instanceof Error ? e.message : String(e));
  }
}

function searchUrl(key: string, applicant: string, page: number, rows: number): string {
  const url = new URL(KIPRIS_PATENT_SEARCH_URL);
  url.searchParams.set("ServiceKey", key);
  url.searchParams.set("applicant", applicant);
  url.searchParams.set("pageNo", String(page));
  url.searchParams.set("numOfRows", String(rows));
  url.searchParams.set("sortSpec", "AD");
  url.searchParams.set("descSort", "true");
  url.searchParams.set("patent", "true");
  url.searchParams.set("utility", "true");
  return url.toString();
}

const items = (xml: string) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

/**
 * 출원인명으로 특허고객번호를 찾는다: 이름으로 검색한 특허 몇 건의 서지 상세에서
 * 이름이 정확히 같은(정규화 후) 출원인의 번호만 모은다.
 */
async function resolveCodes(key: string, names: string[]): Promise<string[]> {
  const wanted = new Set(names.map(normalizeApplicant));
  const codes = new Map<string, number>();
  for (const name of names) {
    const xml = await kiprisFetchText(searchUrl(key, name, 1, 20), { retries: 1 });
    const appNos = items(xml)
      .filter((it) => xmlTag(it, "applicantName").split(/[|,]/).some((n) => wanted.has(normalizeApplicant(n))))
      .map((it) => xmlTag(it, "applicationNumber"))
      .filter(Boolean)
      .slice(0, 4);
    for (const no of appNos) {
      const url = new URL(KIPRIS_PATENT_DETAIL_URL);
      url.searchParams.set("ServiceKey", key);
      url.searchParams.set("applicationNumber", no);
      const detail = await kiprisFetchText(url.toString(), { retries: 1 });
      for (const block of xmlTagAll(detail, "applicantInfo")) {
        const code = xmlTag(block, "code").replace(/\D/g, "");
        if (CODE_RE.test(code) && wanted.has(normalizeApplicant(xmlTag(block, "name")))) codes.set(code, (codes.get(code) ?? 0) + 1);
      }
    }
    if (codes.size) break; // 지금 이름으로 찾았으면 옛 이름은 보지 않는다
  }
  return [...codes.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 3);
}

const fmtDate = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6, 8)}` : v);

Deno.serve(async (req) => {
  const pre = handleCorsPreflight(req);
  if (pre) return pre;
  const limited = await enforceRateLimit(req, { bucket: "consortium-patents", limit: 180, windowSeconds: 300 });
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const org = CONSORTIUM_ORGS.find((o) => o.name === body?.org);
    if (!org) return jsonResponse({ success: false, error: "협의체 기관 이름이 아닙니다." }, 400);
    const page = Math.min(50, Math.max(1, Number(body?.page) || 1));

    const key = await resolveKiprisKey();
    if (!key) throw new Error("KIPRIS_API_KEY is not configured");

    // owner 가 확인한 번호가 있으면 그것만 쓴다 (이름 검색·캐시를 거치지 않음)
    let codes = (org.codes ?? []).filter((c) => CODE_RE.test(c));
    if (!codes.length) {
      const hit = (await readCache())[org.name];
      if (hit && Date.now() - Date.parse(hit.at) < CACHE_DAYS * 86400000) codes = hit.codes.filter((c) => CODE_RE.test(c));
    }
    if (!codes.length) {
      codes = await resolveCodes(key, orgNames(org));
      if (codes.length) {
        const cache = await readCache();
        cache[org.name] = { codes, at: new Date().toISOString() };
        await writeCache(cache);
      }
    }
    if (!codes.length) return jsonResponse({ success: true, org: org.name, codes: [], total: 0, page, hasMore: false, items: [] });

    // 번호가 둘 이상이면(이름이 바뀐 기관) 번호마다 같은 쪽을 받아 합친다
    const pages = await Promise.all(codes.map((c) => kiprisFetchText(searchUrl(key, c, page, PAGE_SIZE), { retries: 1 })));
    const seen = new Set<string>();
    let total = 0, hasMore = false;
    const out = [];
    for (const xml of pages) {
      const n = Number(xmlTag(xml, "totalCount")) || 0;
      total += n;
      if (page * PAGE_SIZE < n) hasMore = true;
      for (const it of items(xml)) {
        const applicationNumber = xmlTag(it, "applicationNumber");
        const status = xmlTag(it, "registerStatus");
        if (!applicationNumber || seen.has(applicationNumber) || EXCLUDED_STATUS.test(status)) continue;
        seen.add(applicationNumber);
        out.push({
          applicationNumber,
          registrationNumber: xmlTag(it, "registerNumber") || undefined,
          title: xmlTag(it, "inventionTitle"),
          applicationDate: fmtDate(xmlTag(it, "applicationDate")),
          registrationDate: fmtDate(xmlTag(it, "registerDate")) || undefined,
          status,
          applicant: xmlTag(it, "applicantName"),
          ipc: xmlTag(it, "ipcNumber").split("|")[0]?.trim() || undefined,
          abstract: xmlTag(it, "astrtCont").slice(0, 220),
        });
      }
    }
    out.sort((a, b) => b.applicationDate.localeCompare(a.applicationDate));
    return jsonResponse({ success: true, org: org.name, codes, total, page, hasMore, items: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[consortium-patents]", msg);
    return jsonResponse({ success: false, error: "특허 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
