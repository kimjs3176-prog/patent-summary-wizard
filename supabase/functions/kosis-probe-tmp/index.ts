// 임시 점검용: KOSIS 응답 상태 확인(키 노출 없음). 점검 후 삭제.
Deno.serve(async () => {
  const key = Deno.env.get("KOSIS_SERVICE_KEY") ?? "";
  const url = `https://apis.data.go.kr/1240000/statisticsData/getStatisticsData?serviceKey=${key}&orgId=145&tblId=DT_145010_009&itmId=T001&objL1=ALL&prdSe=Y&newEstPrdCnt=6&format=json&jsonVD=Y&numOfRows=5000`;
  const r = await fetch(url);
  const t = await r.text();
  return Response.json({ status: r.status, headers: Object.fromEntries([...r.headers].filter(([k]) => !/cookie/i.test(k))), body: t.replaceAll(key, "***").slice(0, 400) });
});
