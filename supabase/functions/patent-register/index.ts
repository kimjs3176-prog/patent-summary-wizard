import { corsHeaders } from '../_shared/cors.ts';
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const ENDPOINT = 'https://apis.data.go.kr/1430000/PttRgstRtInfoInqSvc/getPatentRegisterHistory';

interface LicenseRaw {
  [key: string]: unknown;
}

const asArray = (v: unknown): LicenseRaw[] => (Array.isArray(v) ? (v as LicenseRaw[]) : v ? [v as LicenseRaw] : []);
const str = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  return s ? s : undefined;
};
const fmtDate = (v: unknown): string | undefined => {
  const s = str(v)?.replace(/[^0-9]/g, '');
  if (!s || s.length !== 8) return str(v);
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
};

/** 등록번호를 13자리 원부 조회 형식으로 정규화 */
function normalizeRgstNo(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, '');
  if (digits.length < 7) return null;
  if (digits.length >= 13) return digits.slice(0, 13);
  return digits.padEnd(13, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const limited = await enforceRateLimit(req, { bucket: "patent-register", limit: 60, windowSeconds: 300 });
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.registrationNumber === 'string' ? body.registrationNumber : '';
    const rgstNo = normalizeRgstNo(raw);
    if (!rgstNo) {
      return new Response(JSON.stringify({ success: false, error: '유효한 등록번호가 필요합니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = Deno.env.get('PATENT_REGISTER_API_KEY');
    if (!key) throw new Error('PATENT_REGISTER_API_KEY 미설정');

    const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&type=json&rgstNo=${rgstNo}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`등록원부 API 오류 (${res.status})`);
    const json = await res.json();

    if (json?.resultCode && json.resultCode !== '000') {
      return new Response(JSON.stringify({ success: true, found: false, reason: json.resultMsg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const it = json?.items ?? {};
    const exclusive = asArray(it.elsLcnsList)
      .filter((l) => str(l.elsLcnsPsnNm))
      .map((l) => ({
        holder: str(l.elsLcnsPsnNm),
        cause: str(l.elsLcnsRgstCsNm),
        region: str(l.elsLcnsRgnLcns),
        content: str(l.elsLcnsContLcns),
        startDate: fmtDate(l.elsLcnsStartDate),
        endDate: fmtDate(l.elsLcnsEndDate),
      }));
    const ordinary = asArray(it.noelsLcnsList)
      .filter((l) => str(l.noelsLcnsPsnNm))
      .map((l) => ({
        holder: str(l.noelsLcnsPsnNm),
        cause: str(l.noelsLcnsRgstCsNm),
        region: str(l.noelsLcnsRgnLcns),
        content: str(l.noelsLcnsContLcns),
        startDate: fmtDate(l.noelsLcnsStartDate),
        endDate: fmtDate(l.noelsLcnsEndDate),
      }));
    const owners = asArray(it.owner)
      .filter((o) => str(o.ownerName))
      .map((o) => ({
        name: str(o.ownerName),
        isFinal: str(o.finalOwnerYn) === 'Y',
        changeReason: str(o.ownerRgstCsReason),
        changeDate: fmtDate(o.ownerRgstCsDate),
      }));
    const rights = asArray(it.right)
      .filter((r) => str(r.rgstCsName))
      .map((r) => ({
        kind: str(r.rgstCsName),
        date: fmtDate(r.rgstCsDate),
        reason: str(r.rgstCsReason),
        purpose: str(r.rgstCsPupos),
      }));
    const annuities = asArray(it.pay).map((p) => ({
      from: Number(p.statAnnl) || undefined,
      to: Number(p.lastAnnl) || undefined,
      paidDate: fmtDate(p.payDate),
      amount: Number(p.payAmount) || 0,
    }));
    const lastAnnuity = annuities.reduce((max, a) => Math.max(max, a.to ?? 0), 0);

    const expiry = str(it.cndrtExptnDate);
    let remainingYears: number | null = null;
    if (expiry && expiry.replace(/[^0-9]/g, '').length === 8) {
      const d = expiry.replace(/[^0-9]/g, '');
      const exp = new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)));
      remainingYears = Math.round(((exp.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        data: {
          registrationNumber: str(it.rgstNo),
          registrationDate: fmtDate(it.rgstDate),
          applicationNumber: str(it.applNo),
          claimCount: str(it.claimCount),
          expiryDate: fmtDate(it.cndrtExptnDate),
          remainingYears,
          lastDisposition: str(it.lastDspst),
          applicationType: str(it.applTpcd),
          examRequestDate: fmtDate(it.rfoexDate),
          cpc: str(it.cpcCd),
          owners,
          rights,
          annuities,
          lastAnnuity: lastAnnuity || null,
          exclusiveLicenses: exclusive,
          ordinaryLicenses: ordinary,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('patent-register error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
