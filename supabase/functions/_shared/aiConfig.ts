/**
 * AI 연결 설정은 이 파일 한 곳에 둔다 (모든 Edge Function 이 여기서 주소와 모델을 가져온다).
 *
 * - 게이트웨이: Lovable AI Gateway (OpenAI 호환 Chat Completions). 키는 함수 비밀값 LOVABLE_API_KEY.
 *   AI 호출은 이 게이트웨이로만 한다(supabase/functions/AGENTS.md). 다른 OpenAI 호환 게이트웨이(예: 행정안전부
 *   AI 공통기반)로 옮길 때는 AI_GATEWAY_URL 과 키 이름만 이곳에서 바꾸면 모든 기능이 함께 옮겨 간다.
 * - 모델: 기능의 무게에 따라 세 단계로 나눈다. 함수 비밀값(환경변수)으로 바꿀 수 있고, 없으면 기본값을 쓴다.
 *     AI_MODEL       main  — 요약서·사업화 점수·특허 상담 답변·출원도우미·출원 동향 (기본 google/gemini-3.8-flash)
 *     AI_MODEL_LITE  lite  — 검색어 정리·용어 풀이·규제 찾기·간단한 점수 등 가벼운 작업 (기본 google/gemini-3.1-flash-lite)
 *     AI_MODEL_ALT   alt   — 대체 검색어 제안 (기본 openai/gpt-6-astra, 다른 제공사 모델로도 구동됨을 보이는 자리)
 *
 * Deno(Edge Function)와 Node(vitest)에서 모두 읽히도록 환경변수는 Deno.env → process.env 순서로 찾는다.
 */
export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AiTier = "main" | "lite" | "alt";

export const AI_MODEL_DEFAULTS: Record<AiTier, string> = {
  main: "google/gemini-3.8-flash",
  lite: "google/gemini-3.1-flash-lite",
  alt: "openai/gpt-6-astra",
};

export const AI_MODEL_ENV: Record<AiTier, string> = {
  main: "AI_MODEL",
  lite: "AI_MODEL_LITE",
  alt: "AI_MODEL_ALT",
};

type EnvHost = { Deno?: { env?: { get?: (k: string) => string | undefined } }; process?: { env?: Record<string, string | undefined> } };

function readEnv(name: string): string | undefined {
  const g = globalThis as unknown as EnvHost;
  try {
    const v = g.Deno?.env?.get?.(name);
    if (v != null) return v;
  } catch {
    // 권한이 없는 환경에서는 process.env 로
  }
  return g.process?.env?.[name];
}

/** 모델 이름: 'provider/model' 꼴만 받는다 (잘못 넣은 값으로 모든 AI 기능이 멈추지 않게). */
const MODEL_RE = /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** 기능 단계별 모델. 환경변수가 비었거나 꼴이 맞지 않으면 기본값. */
export function aiModel(tier: AiTier = "main"): string {
  const v = readEnv(AI_MODEL_ENV[tier])?.trim();
  return v && MODEL_RE.test(v) ? v : AI_MODEL_DEFAULTS[tier];
}
