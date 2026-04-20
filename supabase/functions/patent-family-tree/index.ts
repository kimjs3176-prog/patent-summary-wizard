import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FamilyPatent {
  patentId: string;
  title: string;
  applicationDate?: string;
  registrationDate?: string;
  ipc?: string;
  ipcCategory?: string;
  isCurrent: boolean;
  relevanceScore?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assignee, currentPatentNumber, currentPatentTitle } = await req.json();
    if (!assignee || typeof assignee !== "string") {
      return new Response(JSON.stringify({ success: false, error: "출원인 정보가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Tokenize current patent title for keyword-relevance scoring
    const stopwords = new Set(["방법", "장치", "시스템", "기술", "이용", "위한", "관한", "관련", "포함", "제공", "이를", "그리고", "또는", "있는", "되는", "사용", "통해", "통한"]);
    const titleTokens = (currentPatentTitle || "")
      .toString()
      .replace(/[\[\](),.·\-/]/g, " ")
      .split(/\s+/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length >= 2 && !stopwords.has(t));
    const tokenSet = new Set<string>(titleTokens);
    const scoreRelevance = (title: string): number => {
      if (!title || tokenSet.size === 0) return 0;
      let score = 0;
      const lower = title.toLowerCase();
      tokenSet.forEach((tk) => {
        if (lower.includes(tk.toLowerCase())) score += 2;
      });
      return score;
    };

    // Cache check (7d TTL). Key includes patent number so each search produces its own relevance-filtered list.
    const cacheKey = `fam_${assignee.substring(0, 60)}_${(currentPatentNumber || "x").replace(/[^0-9]/g, "").slice(0, 16)}`;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
      const { data: cached } = await supabase
        .from("patent_data_cache")
        .select("patent_data, created_at")
        .eq("patent_number", cacheKey)
        .maybeSingle();
      if (cached?.patent_data) {
        const cachedAt = new Date(cached.created_at).getTime();
        if (Date.now() - cachedAt < 7 * 24 * 60 * 60 * 1000) {
          // mark current
          const data = cached.patent_data as any;
          if (Array.isArray(data.patents)) {
            data.patents = data.patents.map((p: FamilyPatent) => ({
              ...p,
              isCurrent: !!(currentPatentNumber && p.patentId.replace(/[^0-9]/g, "").includes(currentPatentNumber.replace(/[^0-9]/g, ""))),
            }));
          }
          return new Response(JSON.stringify({ success: true, ...data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } catch (_) { /* ignore */ }

    let KIPRIS_API_KEY = Deno.env.get("KIPRIS_API_KEY");
    try {
      const { data: row } = await supabase.from("site_settings").select("value").eq("key", "kipris_api_key").maybeSingle();
      if (row?.value) KIPRIS_API_KEY = row.value;
    } catch { /* ignore */ }

    if (!KIPRIS_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "KIPRIS API 키가 설정되지 않았습니다." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
    url.searchParams.set("ServiceKey", KIPRIS_API_KEY);
    url.searchParams.set("applicant", assignee);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("sortSpec", "AD");
    url.searchParams.set("descSort", "true");
    url.searchParams.set("patent", "true");
    url.searchParams.set("utility", "true");

    const res = await fetch(url.toString());
    const text = await res.text();
    if (!res.ok || text.includes("<successYN>N</successYN>")) {
      return new Response(JSON.stringify({ success: true, patents: [], assignee }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ipcCategoryMap: Record<string, string> = {
      A01: "농업·식품", A22: "축산·식품가공", A23: "식품·음료", A61: "의약·헬스케어",
      B01: "화학공정", B02: "곡물가공", B07: "선별·분리", B29: "성형", B65: "포장·물류",
      C02: "수처리", C05: "비료", C07: "정밀화학", C08: "고분자·소재", C12: "바이오·발효",
      F25: "냉장·냉동", F26: "건조",
      G01: "계측·검사", G05: "제어·자동화", G06: "ICT·SW", G16: "바이오IT",
      H04: "통신·IoT",
    };

    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const patents: FamilyPatent[] = [];
    const seen = new Set<string>();

    for (const m of items) {
      const itemXml = m[1];
      const getField = (field: string): string | undefined => {
        const cdata = itemXml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${field}>`, "i"));
        if (cdata) return cdata[1].trim();
        const simple = itemXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`, "i"));
        return simple ? simple[1].trim() : undefined;
      };

      const applicationNumber = getField("applicationNumber") || "";
      const registrationNumber = getField("registerNumber") || getField("registrationNumber") || "";
      const inventionTitle = getField("inventionTitle") || "";
      const ipc = getField("ipcNumber") || "";
      const applicationDate = getField("applicationDate") || "";
      const registerDate = getField("registerDate") || "";

      let displayNumber = "";
      if (registrationNumber) {
        const c = registrationNumber.replace(/[^0-9]/g, "");
        if (c.length >= 9 && c.startsWith("10")) displayNumber = `10-${c.slice(2, 9)}`;
        else if (c.length >= 7) displayNumber = `10-${c.slice(-7)}`;
      } else if (applicationNumber) {
        const c = applicationNumber.replace(/[^0-9]/g, "");
        if (c.length === 13 && c.startsWith("10")) displayNumber = `10-${c.slice(2, 6)}-${c.slice(6)}`;
      }
      if (!displayNumber || !inventionTitle) continue;
      if (seen.has(displayNumber)) continue;
      seen.add(displayNumber);

      const ipcMain = ipc.split(/[,;|]/)[0]?.trim().replace(/\s/g, "").slice(0, 3) || "";
      const category = ipcCategoryMap[ipcMain] || "기타";

      const isCurrent = !!(currentPatentNumber && displayNumber.replace(/[^0-9]/g, "").includes(currentPatentNumber.replace(/[^0-9]/g, "")));

      patents.push({
        patentId: displayNumber,
        title: inventionTitle,
        applicationDate: applicationDate ? `${applicationDate.slice(0, 4)}.${applicationDate.slice(4, 6)}.${applicationDate.slice(6, 8)}` : undefined,
        registrationDate: registerDate ? `${registerDate.slice(0, 4)}.${registerDate.slice(4, 6)}.${registerDate.slice(6, 8)}` : undefined,
        ipc: ipc.split(/[,;|]/)[0]?.trim(),
        ipcCategory: category,
        isCurrent,
        relevanceScore: scoreRelevance(inventionTitle),
      });

      if (patents.length >= 80) break;
    }

    // Determine current patent's IPC category for category bonus
    const currentPatent = patents.find((p) => p.isCurrent);
    const currentCategory = currentPatent?.ipcCategory;

    // Apply IPC category bonus + boost current patent
    patents.forEach((p) => {
      if (p.isCurrent) {
        p.relevanceScore = Number.MAX_SAFE_INTEGER;
      } else if (currentCategory && p.ipcCategory === currentCategory) {
        p.relevanceScore = (p.relevanceScore || 0) + 1;
      }
    });

    // Filter to keyword-relevant patents (score > 0). Always keep current patent.
    // If too few survive, fall back to top-N by recency to avoid an empty tree.
    let filtered = patents.filter((p) => p.isCurrent || (p.relevanceScore || 0) > 0);
    if (filtered.length < 4) {
      // Not enough relevance hits — keep best-effort: top by IPC category match, else top recent
      const sameCategory = patents.filter((p) => !p.isCurrent && currentCategory && p.ipcCategory === currentCategory);
      const merged = [...filtered, ...sameCategory.filter((p) => !filtered.includes(p))];
      filtered = merged.length >= 4 ? merged : patents.slice(0, Math.max(8, filtered.length));
    }

    // Sort by relevance desc, then by date desc (current patent first via Number.MAX_SAFE_INTEGER)
    filtered.sort((a, b) => {
      const sa = a.relevanceScore || 0;
      const sb = b.relevanceScore || 0;
      if (sb !== sa) return sb - sa;
      const da = (a.registrationDate || a.applicationDate || "").replace(/\./g, "");
      const db = (b.registrationDate || b.applicationDate || "").replace(/\./g, "");
      return db.localeCompare(da);
    });

    // Deduplicate by normalized title — same title across multiple application/registration entries
    // should appear as a single node (keep most recent date, prefer current patent).
    const normalizeTitle = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[\[\](){}<>·,.\-_/\\]/g, "")
        .trim();
    const titleGroups = new Map<string, FamilyPatent & { _count?: number }>();
    for (const p of filtered) {
      const key = normalizeTitle(p.title);
      if (!key) continue;
      const existing = titleGroups.get(key);
      if (!existing) {
        titleGroups.set(key, { ...p, _count: 1 });
        continue;
      }
      existing._count = (existing._count || 1) + 1;
      // Prefer current patent as the representative
      if (p.isCurrent && !existing.isCurrent) {
        titleGroups.set(key, { ...p, _count: existing._count });
        continue;
      }
      if (existing.isCurrent && !p.isCurrent) continue;
      // Otherwise keep the one with the most recent date
      const dateA = (existing.registrationDate || existing.applicationDate || "").replace(/\./g, "");
      const dateB = (p.registrationDate || p.applicationDate || "").replace(/\./g, "");
      if (dateB > dateA) {
        titleGroups.set(key, { ...p, _count: existing._count });
      }
    }
    const deduped = Array.from(titleGroups.values()).map((p) => {
      const count = p._count || 1;
      const { _count, ...rest } = p;
      return count > 1 ? { ...rest, title: `${rest.title} (${count}건 통합)` } : rest;
    });

    // Re-sort after dedup
    deduped.sort((a, b) => {
      const sa = a.relevanceScore || 0;
      const sb = b.relevanceScore || 0;
      if (sb !== sa) return sb - sa;
      const da = (a.registrationDate || a.applicationDate || "").replace(/\./g, "");
      const db = (b.registrationDate || b.applicationDate || "").replace(/\./g, "");
      return db.localeCompare(da);
    });

    const finalPatents = deduped.slice(0, 30);

    // Ensure current patent is in list
    if (currentPatentNumber && !finalPatents.some((p) => p.isCurrent) && currentPatentTitle) {
      finalPatents.unshift({
        patentId: currentPatentNumber,
        title: currentPatentTitle,
        ipcCategory: "현재 분석 특허",
        isCurrent: true,
      });
    }

    const responseData = { patents: finalPatents, assignee };

    try {
      await supabase.from("patent_data_cache").upsert({
        patent_number: cacheKey,
        patent_data: responseData,
        related_patents: [],
      }, { onConflict: "patent_number" });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ success: true, ...responseData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("patent-family-tree error:", error);
    return new Response(JSON.stringify({ success: false, error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
