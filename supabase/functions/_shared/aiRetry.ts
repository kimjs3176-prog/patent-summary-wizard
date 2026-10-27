// Retries AI gateway calls on temporary overload (429/5xx) so short outages
// don't surface as failed features.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const DELAYS_MS = [800, 2000];

export class AiUnavailableError extends Error {
  constructor(public status: number) {
    super(`AI failed ${status}`);
  }
}

export async function fetchAiWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, init);
    if (r.ok) return r;
    if (!RETRYABLE.has(r.status) || attempt >= DELAYS_MS.length) {
      await r.body?.cancel();
      throw new AiUnavailableError(r.status);
    }
    await r.body?.cancel();
    await new Promise((res) => setTimeout(res, DELAYS_MS[attempt]));
  }
}

// Temporary AI outages are reported as a normal "not available" result
// (HTTP 200, success:false) so screens show their own fallback message.
export function aiUnavailableResponse(headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ success: false, retryable: true, error: "AI 분석이 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요." }),
    { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
  );
}
