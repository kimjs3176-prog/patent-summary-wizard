import { kiprisFetchText, xmlTag } from "./kipris.ts";

/** KIPRIS 상표 검색 (상표명 기준). 목록 다운로드 등에서만 사용한다. */

// 거절/소멸/취하/포기 등 권리가 유효하지 않은 상태는 제외
const EXCLUDED_STATUS = /(거절|소멸|취하|포기|무효)/;

export interface TrademarkItem {
  applicationNumber: string;
  registrationNumber: string;
  title: string;
  applicationDate: string;
  registerDate: string;
  status: string;
  applicant: string;
  drawing: string;
}

const fmtDate = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d);

/**
 * 상표명으로 KIPRIS 상표를 조회한다.
 * orgNames가 주어지면 출원인/권리자가 해당 기관 중 하나를 포함하는 건만 남긴다.
 */
export async function searchTrademarks(
  keyword: string,
  apiKey: string,
  orgNames: string[],
  maxPages = 5,
): Promise<TrademarkItem[]> {
  const out: TrademarkItem[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL("https://plus.kipris.or.kr/kipo-api/kipi/trademarkInfoSearchService/getWordSearch");
    url.searchParams.set("ServiceKey", apiKey);
    url.searchParams.set("searchString", keyword);
    url.searchParams.set("pageNo", String(page));
    url.searchParams.set("numOfRows", "500");
    url.searchParams.set("docsCount", "500");
    const xml = await kiprisFetchText(url.toString(), { retries: 1, timeoutMs: 20000 });
    if (xml.includes("<successYN>N</successYN>")) break;

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    for (const m of items) {
      const x = m[1];
      const title = xmlTag(x, "title");
      const applicationNumber = xmlTag(x, "applicationNumber");
      if (!title || !applicationNumber || seen.has(applicationNumber)) continue;
      const status = xmlTag(x, "applicationStatus") || xmlTag(x, "registrationStatus");
      if (status && EXCLUDED_STATUS.test(status)) continue;
      const applicant = xmlTag(x, "applicantName");
      const rightHolder = xmlTag(x, "regPrivilegeName");
      const ownerText = `${applicant} ${rightHolder}`;
      if (orgNames.length > 0 && !orgNames.some((n) => ownerText.includes(n))) continue;
      seen.add(applicationNumber);
      out.push({
        applicationNumber,
        registrationNumber: xmlTag(x, "registrationNumber"),
        title,
        applicationDate: fmtDate(xmlTag(x, "applicationDate")),
        registerDate: fmtDate(xmlTag(x, "registrationDate")),
        status,
        applicant: applicant || rightHolder,
        drawing: xmlTag(x, "bigDrawing") || xmlTag(x, "drawing"),
      });
    }
    const totalCount = Number(xmlTag(xml, "totalCount")) || 0;
    if (page * 500 >= totalCount || items.length === 0) break;
  }
  return out;
}
