// 서버 AI — Lovable AI 게이트웨이(OpenAI 호환 chat completions)로 부른다. 키는 환경변수 LOVABLE_API_KEY (Lovable Cloud 가 넣어 준다).
// 사이트의 다른 함수(요약·점수·출원 동향)와 같은 게이트웨이·모델을 쓴다. 모델은 FILING_AI_MODEL 로 바꿀 수 있다.
export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const SERVER_MODEL = process.env.FILING_AI_MODEL || "google/gemini-3.8-flash";
export const gatewayEnabled = () => !!process.env.LOVABLE_API_KEY;

/** 게이트웨이가 성공(2xx)이 아닌 답을 줬거나 연결하지 못했을 때. status 0 은 연결 실패·시간 초과다. */
export class GatewayError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
  }
}

// 붐빔·일시 오류는 잠깐 기다렸다 2번까지 다시 보낸다 (_shared/aiRetry.ts 와 같은 규칙)
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const DELAYS_MS = [1000, 3000];
// Edge Function 한 번의 실행 시간 안에 끝나도록 요청마다 시간 제한을 둔다
const TIMEOUT_MS = 140_000;

/**
 * system·user 지침으로 한 번 답을 받는다. json 이면 JSON 객체로만 답하게 한다.
 * 돌려주는 값: { text, finishReason, model } — finishReason 은 "stop" | "length" | "content_filter" 등 게이트웨이 값 그대로.
 */
export async function chat({ system, user, json = false, maxTokens }, { fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), timeoutMs = TIMEOUT_MS } = {}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new GatewayError(401, "LOVABLE_API_KEY 가 없습니다.");
  const body = JSON.stringify({
    model: SERVER_MODEL,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(json ? { response_format: { type: "json_object" } } : {})
  });
  for (let attempt = 0; ; attempt++) {
    let r;
    try {
      r = await fetchImpl(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (e) {
      if (attempt < DELAYS_MS.length && e?.name !== "TimeoutError") { await sleep(DELAYS_MS[attempt]); continue; }
      throw new GatewayError(0, e?.name === "TimeoutError" ? "AI 답변이 너무 오래 걸립니다." : "AI 서버에 연결하지 못했습니다.");
    }
    if (r.ok) {
      const data = await r.json().catch(() => null);
      const choice = data?.choices?.[0];
      const content = choice?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.map(p => p?.text ?? "").join("") : "";
      return { text, finishReason: choice?.finish_reason ?? null, model: data?.model || SERVER_MODEL };
    }
    const detail = await r.text().catch(() => "");
    if (RETRYABLE.has(r.status) && attempt < DELAYS_MS.length) { await sleep(DELAYS_MS[attempt]); continue; }
    throw new GatewayError(r.status, detail.slice(0, 300) || `HTTP ${r.status}`);
  }
}

// 게이트웨이 오류를 사용자에게 보여줄 [HTTP 상태, 문구] 로 바꾼다. 해당 없으면 null
export function gatewayErrorResponse(e) {
  if (!(e instanceof GatewayError)) return e?.status ? [e.status, e.message] : null;
  if (e.status === 429) return [429, "AI 사용량이 많습니다. 잠시 뒤 다시 시도하세요."];
  if (e.status === 402) return [503, "서버 AI 사용 한도(Lovable AI 크레딧)를 다 썼습니다. 관리자에게 알려 주세요."];
  if (e.status === 401 || e.status === 403) return [503, "서버의 LOVABLE_API_KEY 를 확인하세요."];
  if (e.status === 400) return [502, "AI 요청 형식 오류입니다. 다시 시도하세요."];
  if (e.status === 0) return [502, e.message];
  return [502, `AI 서버 오류 (${e.status})`];
}
