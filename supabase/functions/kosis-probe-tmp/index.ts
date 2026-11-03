// 임시 점검용: 등록된 모든 KOSIS 시장을 실제로 조회한다(키 노출 없음). 점검 후 삭제.
import { KOSIS_SERIES, fetchKosisRef } from "./kosis.ts";
Deno.serve(async () => {
  const key = Deno.env.get("KOSIS_SERVICE_KEY");
  if (!key) return Response.json({ hasKey: false });
  const out: string[] = [];
  for (const s of KOSIS_SERIES) {
    const t0 = Date.now();
    const r = await fetchKosisRef(s.label, s, key) as any;
    out.push(r ? `${s.label}|${r.base_year}|${r.base_value_eok}|${r.cagr}|${Date.now() - t0}ms` : `${s.label}|FAIL|${Date.now() - t0}ms`);
  }
  return Response.json(out);
});
