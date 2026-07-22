import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Module-level cooldown: after upstream 5xx / overload from personal Gemini or Groq,
// skip that provider for a short period so subsequent requests don't pay the failure latency.
let geminiCooldownUntil = 0;
const PROVIDER_COOLDOWN_MS = 90_000; // 90s
function markCooldown(_provider: "gemini", ms = PROVIDER_COOLDOWN_MS) {
  geminiCooldownUntil = Date.now() + ms;
}
const GEMINI_TIMEOUT_MS = 8_000;

function withTimeout(parent: AbortSignal | undefined, ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(t);
      if (parent) parent.removeEventListener("abort", onAbort);
    },
  };
}

async function callAIChatCompletions(
  payload: Record<string, unknown> & { model: string },
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (GEMINI_API_KEY && Date.now() >= geminiCooldownUntil) {
    const t = withTimeout(init.signal, GEMINI_TIMEOUT_MS);
    try {
      const geminiModel = payload.model.replace(/^google\//, "");
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          signal: t.signal,
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, model: geminiModel }),
        },
      );
      if (r.ok) {
        console.log("[AI] using personal Gemini API");
        t.cancel();
        return r;
      }
      const errText = await r.text().catch(() => "");
      if (r.status >= 500 || r.status === 429) markCooldown("gemini");
      console.warn(`[AI] personal Gemini failed ${r.status}: ${errText.slice(0, 200)} — falling back to Lovable AI`);
    } catch (e) {
      markCooldown("gemini");
      console.warn("[AI] personal Gemini error, falling back:", e);
    } finally {
      t.cancel();
    }
  }
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: init.signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

interface PatentData {
  title?: string;
  titleKo?: string;
  abstract?: string;
  assignee?: string;
  classifications?: string[];
  claims?: string[];
  description?: string;
  patentNumber?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ success: false, error: "잘못된 요청" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { patentNumber, patentData } = body as { patentNumber?: string; patentData?: PatentData };
    if (!patentNumber || !patentData) {
      return new Response(JSON.stringify({ success: false, error: "특허 정보 필요" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "서비스 일시 오류" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = `명칭: ${patentData.titleKo || patentData.title || ""}
출원인: ${patentData.assignee || ""}
IPC: ${(patentData.classifications || []).slice(0, 3).join(", ")}
초록: ${(patentData.abstract || "").substring(0, 600)}
대표청구항: ${(patentData.claims?.[0] || "").substring(0, 300)}`;

    const systemPrompt = `당신은 농업·바이오 특허의 '용도전환(피벗팅)' 발상 전문가다.
주어진 특허의 본래 용도를 넘어, 핵심 메커니즘·구성·효과를 다른 산업/문제로 전이하여 새로운 활용 가능성을 발굴한다.

규칙:
- 본 특허의 핵심 기술원리(메커니즘, 작용기전, 구조적 특징)를 1줄로 추출한 뒤, 이를 기반으로 본래 용도와 거리가 먼 4가지 새로운 용도를 제안한다.
- 각 피벗 아이디어는 '서로 다른 산업·도메인'을 다뤄야 한다 (예: 의료/헬스케어, 환경·에너지, 식품·소비재, 우주·국방, 반려동물, 스마트시티, 화장품, 폐기물 자원화 등).
- 단순한 응용 확장이 아니라, '발상의 전환'이 느껴지는 비자명한 제안일 것.
- 각 아이디어는 (a)타깃 산업, (b)구체 용도, (c)전이된 핵심 가치, (d)현실성(상/중/하)을 포함.
- 모든 텍스트는 한국어. 과장된 마케팅 표현 금지, 간결·명료.

JSON 형식으로만 응답:
{
  "coreMechanism": "이 특허의 핵심 작용원리 1문장 (60자 이내)",
  "pivots": [
    {
      "industry": "타깃 산업/도메인 (10자 이내)",
      "title": "전환 아이디어 제목 (25자 이내)",
      "useCase": "구체적 활용 시나리오 (90~140자)",
      "transferredValue": "전이된 핵심 가치 (40~70자)",
      "feasibility": "상" | "중" | "하",
      "feasibilityReason": "현실성 판단 근거 (40~70자)"
    }
  ]
}
pivots 배열은 정확히 4개.`;

    const aiController = new AbortController();
    const aiTimer = setTimeout(() => aiController.abort(), 45000);
    let response: Response;
    try {
      response = await callAIChatCompletions(
        {
          model: "google/gemini-3.6-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: ctx },
          ],
          temperature: 0.85,
          max_tokens: 1500,
          response_format: { type: "json_object" },
        },
        { signal: aiController.signal },
      );
    } finally {
      clearTimeout(aiTimer);
    }

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "서비스 크레딧 부족" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "요청이 많습니다. 잠시 후 재시도" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI 서비스 오류");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI 응답 비어있음");

    let parsed: any;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("파싱 실패");
      parsed = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-pivoting error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});