import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// KIPRIS Plus 국유특허 기본조회
const ENDPOINT = 'http://plus.kipris.or.kr/openapi/rest/GovernmentownershipPatentService/governmentownershipPatentInfo';

/** 등록번호를 13자리(10 + 7자리 + 0000) 형식으로 정규화 */
function normalizeRgstNo(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, '');
  if (digits.length < 7) return null;
  if (digits.length >= 13) return digits.slice(0, 13);
  return digits.padEnd(13, '0');
}

const pick = (xml: string, tag: string): string | undefined => {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  const v = m?.[1]?.trim();
  return v ? v : undefined;
};

const fmtDate = (v?: string): string | undefined => {
  if (!v) return undefined;
  const s = v.replace(/[^0-9]/g, '');
  if (s.length !== 8) return v;
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

    const key = Deno.env.get('KIPRIS_API_KEY');
    if (!key) throw new Error('KIPRIS_API_KEY 미설정');

    const url = `${ENDPOINT}?accessKey=${encodeURIComponent(key)}&registrationNumber=${rgstNo}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`국유특허 API 오류 (${res.status})`);
    const xml = await res.text();

    const block = xml.match(/<GovernmentownershipPatentInfo>[\s\S]*?<\/GovernmentownershipPatentInfo>/i)?.[0];
    if (!block) {
      return new Response(JSON.stringify({ success: true, found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = {
      registrationNumber: pick(block, 'RegistrationNumber'),
      institution: pick(block, 'InventionInstitution'),
      title: pick(block, 'Titleofinvention'),
      registrationDate: fmtDate(pick(block, 'RegistrationDate')),
      durationUntil: fmtDate(pick(block, 'Continuanceduration')),
      // 무상 / 유상
      chargeType: pick(block, 'NochargeType'),
      evaluationGrade: pick(block, 'EvaluationGrade'),
      applicationNumber: pick(block, 'ApplicationNumber'),
      ipType: pick(block, 'IntellectualpropertyType'),
    };

    return new Response(JSON.stringify({ success: true, found: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('[govt-patent]', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
