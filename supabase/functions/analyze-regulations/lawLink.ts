// Public law page anyone can open. The API's own detail link (DRF/lawService.do)
// only works from registered servers and exposes the API account ID, so never use it.
export function publicLawLink(law: { mst?: unknown; effectiveDate?: unknown; detailLink?: unknown }): string | undefined {
  let mst = law.mst ? String(law.mst).trim() : "";
  let efYd = law.effectiveDate ? String(law.effectiveDate).replace(/[^0-9]/g, "") : "";
  if (!mst && typeof law.detailLink === "string") {
    const q = new URLSearchParams(law.detailLink.split("?")[1] || "");
    mst = q.get("MST") || "";
    efYd = efYd || q.get("efYd") || "";
  }
  if (!/^\d+$/.test(mst)) return undefined;
  return `https://www.law.go.kr/lsInfoP.do?lsiSeq=${mst}${/^\d{8}$/.test(efYd) ? `&efYd=${efYd}` : ""}`;
}
