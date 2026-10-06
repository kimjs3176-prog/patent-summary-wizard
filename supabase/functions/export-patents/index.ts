import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { resolveKiprisKey, kiprisFetchText, xmlTag } from "../_shared/kipris.ts";
import { searchTrademarks } from "../_shared/trademark.ts";

/** One page of the filtered KIPRIS patent list for bulk export. Client pages through totalCount. */

const ORGS = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원"];
// KIPRIS lastvalue codes
const STATUS_CODES: Record<string, string> = {
  all: "", registered: "R", published: "A", rejected: "J", expired: "F", withdrawn: "C", abandoned: "G", invalid: "I",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fmt = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d);
const ymd = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.replace(/-/g, "") : "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const limited = await enforceRateLimit(req, { bucket: "export-patents", limit: 300, windowSeconds: 300 });
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const org = String(body.org ?? "");
    if (!ORGS.includes(org)) return json({ success: false, error: "기관을 선택해 주세요." }, 400);
    const inventor = typeof body.inventor === "string" ? body.inventor.trim().slice(0, 50) : "";
    if (inventor && !/^[가-힣a-zA-Z\s]+$/.test(inventor)) return json({ success: false, error: "발명자 이름을 확인해 주세요." }, 400);
    const status = STATUS_CODES[String(body.status ?? "all")] ?? "";
    const from = ymd(body.from), to = ymd(body.to);
    const pageNo = Math.max(1, Math.min(200, Number(body.pageNo) || 1));
    const rows = Math.max(1, Math.min(500, Number(body.numOfRows) || 500));
    // 상표명이 주어지면 해당 기관 보유 상표도 함께 조회 (1페이지 요청 시에만)
    const trademarkKeyword = typeof body.trademarkKeyword === "string" ? body.trademarkKeyword.trim().slice(0, 50) : "";

    const key = await resolveKiprisKey();
    if (!key) return json({ success: false, error: "KIPRIS 키가 설정되지 않았습니다." }, 500);

    let trademarks: unknown[] = [];
    if (trademarkKeyword && pageNo === 1) {
      try {
        trademarks = await searchTrademarks(trademarkKeyword, key, [org]);
      } catch (e) {
        console.error("trademark search failed:", e instanceof Error ? e.message : e);
      }
    }

    const url = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
    const p = url.searchParams;
    p.set("ServiceKey", key);
    p.set("applicant", org);
    if (inventor) p.set("inventors", inventor);
    if (from || to) p.set("applicationDate", `${from || "19000101"}~${to || "29991231"}`);
    if (status) p.set("lastvalue", status);
    p.set("patent", "true");
    p.set("utility", "true");
    p.set("pageNo", String(pageNo));
    p.set("numOfRows", String(rows));
    p.set("sortSpec", "AD");
    p.set("descSort", "true");

    const xml = await kiprisFetchText(url.toString(), { retries: 2, timeoutMs: 25000 });
    if (xml.includes("<successYN>N</successYN>")) {
      return json({ success: false, error: xmlTag(xml, "resultMsg") || "KIPRIS 조회 실패" }, 502);
    }
    const totalCount = Number(xmlTag(xml, "totalCount")) || 0;
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const x = m[1];
      return {
        applicationNumber: xmlTag(x, "applicationNumber"),
        registrationNumber: xmlTag(x, "registerNumber"),
        title: xmlTag(x, "inventionTitle"),
        applicationDate: fmt(xmlTag(x, "applicationDate")),
        openDate: fmt(xmlTag(x, "openDate")),
        registerDate: fmt(xmlTag(x, "registerDate")),
        status: xmlTag(x, "registerStatus"),
        applicant: xmlTag(x, "applicantName"),
        ipc: xmlTag(x, "ipcNumber"),
        abstract: xmlTag(x, "astrtCont"),
      };
    });
    return json({ success: true, totalCount, items, trademarks });
  } catch (e) {
    console.error("export-patents error:", e);
    return json({ success: false, error: "조회 중 오류가 발생했습니다." }, 500);
  }
});
