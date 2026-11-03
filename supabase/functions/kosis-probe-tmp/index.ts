// 임시 점검용: KOSIS 통계표 구조(항목·분류·연도)를 요약해 돌려준다. 키는 노출하지 않음. 점검 후 삭제.
Deno.serve(async (req) => {
  const key = Deno.env.get("KOSIS_SERVICE_KEY");
  if (!key) return Response.json({ hasKey: false });
  const { orgId, tblId, itmId = "ALL", objL2, objL3, years = 6, c1 } = await req.json();
  const url = `https://apis.data.go.kr/1240000/statisticsData/getStatisticsData?serviceKey=${key}` +
    `&orgId=${orgId}&tblId=${tblId}&itmId=${itmId}&objL1=ALL${objL2 ? "&objL2=ALL" : ""}${objL3 ? "&objL3=ALL" : ""}&prdSe=Y&newEstPrdCnt=${years}&format=json&jsonVD=Y&numOfRows=5000`;
  const r = await fetch(url);
  const text = await r.text();
  let j: any;
  try { j = JSON.parse(text); } catch { return Response.json({ status: r.status, raw: text.replaceAll(key, "***").slice(0, 400) }); }
  const it = j?.response?.body?.items?.item;
  const arr: any[] = Array.isArray(it) ? it : it ? [it] : [];
  const uniq = (f: (i: any) => string) => [...new Set(arr.map(f))];
  const sample = c1 ? arr.filter((i) => i.C1_NM === c1).map((i) => [i.PRD_DE, i.ITM_ID, i.C2_NM ?? "", i.DT, i.UNIT_NM]) : [];
  return Response.json({
    status: r.status, header: j?.response?.header, total: j?.response?.body?.totalCount, count: arr.length,
    items: uniq((i) => `${i.ITM_ID}:${i.ITM_NM}:${i.UNIT_NM}`),
    c1: uniq((i) => `${i.C1}:${i.C1_NM}`).slice(0, 150),
    c2: uniq((i) => `${i.C2 ?? ""}:${i.C2_NM ?? ""}`).slice(0, 80),
    years: uniq((i) => String(i.PRD_DE)).sort(),
    sample: sample.slice(0, 60),
  });
});
