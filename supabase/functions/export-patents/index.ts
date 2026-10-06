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
    // 발명자 이름은 목록 API에 없고 상세 API에만 있으므로, 요청 시 상세 조회를 병행한다
    const withInventors = body.withInventors === true;
    // 상표명이 주어지면 해당 기관 보유 상표도 함께 조회 (1페이지 요청 시에만)
    const trademarkKeyword = typeof body.trademarkKeyword === "string" ? body.trademarkKeyword.trim().slice(0, 50) : "";
    // 권리 종류: all | patent | utility | design | trademark
    const ipType = ["all", "patent", "utility", "design", "trademark"].includes(String(body.ipType)) ? String(body.ipType) : "all";

    const key0 = await resolveKiprisKey();
    if (!key0) return json({ success: false, error: "KIPRIS 키가 설정되지 않았습니다." }, 500);

    // 디자인/상표는 전용 단어검색 API로 조회한다 (출원인명 검색은 미지원 — 검색어 필수)
    if (ipType === "design" || ipType === "trademark") {
      if (!trademarkKeyword) {
        return json({ success: false, error: ipType === "design" ? "디자인은 물품명을 입력해 주세요." : "상표는 상표명을 입력해 주세요." }, 400);
      }
      const service = ipType === "design" ? "designInfoSearchService" : "trademarkInfoSearchService";
      const kwParam = ipType === "design" ? "articleName" : "searchString";
      const url0 = new URL(`https://plus.kipris.or.kr/kipo-api/kipi/${service}/getWordSearch`);
      url0.searchParams.set("ServiceKey", key0);
      url0.searchParams.set(kwParam, trademarkKeyword);
      url0.searchParams.set("pageNo", String(pageNo));
      url0.searchParams.set("numOfRows", String(rows));
      url0.searchParams.set("docsCount", String(rows));
      const xml0 = await kiprisFetchText(url0.toString(), { retries: 2, timeoutMs: 25000 });
      if (xml0.includes("<successYN>N</successYN>")) {
        return json({ success: false, error: xmlTag(xml0, "resultMsg") || "KIPRIS 조회 실패" }, 502);
      }
      const inRange = (d: string) => (!from || d >= fmt(from)) && (!to || d <= fmt(to));
      const items0 = [...xml0.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
        const x = m[1];
        return {
          applicationNumber: xmlTag(x, "applicationNumber"),
          registrationNumber: xmlTag(x, "registrationNumber"),
          title: xmlTag(x, "title") || xmlTag(x, "articleName"),
          applicationDate: fmt(xmlTag(x, "applicationDate")),
          openDate: fmt(xmlTag(x, "openDate") || xmlTag(x, "publicationDate")),
          registerDate: fmt(xmlTag(x, "registrationDate")),
          status: xmlTag(x, "applicationStatus") || xmlTag(x, "registrationStatus"),
          applicant: xmlTag(x, "applicantName"),
          ipc: xmlTag(x, "designMainClassification"),
          abstract: "",
          inventors: xmlTag(x, "inventorName"),
        };
      }).filter((i) => i.title && i.applicationNumber && i.applicant.includes(org) && inRange(i.applicationDate));
      return json({ success: true, totalCount: items0.length, items: items0, trademarks: [] });
    }

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
    p.set("patent", ipType === "utility" ? "false" : "true");
    p.set("utility", ipType === "patent" ? "false" : "true");
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
        inventors: "",
      };
    });

    if (withInventors && items.length > 0) {
      // 상세 API는 건당 1회 호출 — 동시 5건으로 제한해 KIPRIS 부하를 막는다
      const CONCURRENCY = 5;
      for (let i = 0; i < items.length; i += CONCURRENCY) {
        await Promise.all(items.slice(i, i + CONCURRENCY).map(async (it) => {
          try {
            const dUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch");
            dUrl.searchParams.set("ServiceKey", key);
            dUrl.searchParams.set("applicationNumber", it.applicationNumber.replace(/[^0-9]/g, ""));
            const dXml = await kiprisFetchText(dUrl.toString(), { retries: 1, timeoutMs: 15000 });
            const names = [...dXml.matchAll(/<inventorInfo>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/inventorInfo>/g)]
              .map((m) => m[1].trim()).filter(Boolean);
            it.inventors = names.join(", ");
          } catch { /* 발명자 조회 실패 시 빈 값 유지 */ }
        }));
      }
    }
    return json({ success: true, totalCount, items, trademarks });
  } catch (e) {
    console.error("export-patents error:", e);
    return json({ success: false, error: "조회 중 오류가 발생했습니다." }, 500);
  }
});
