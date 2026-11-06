import { afterEach, describe, expect, it } from "vitest";
import { AI_GATEWAY_URL, AI_MODEL_DEFAULTS, aiModel } from "../../supabase/functions/_shared/aiConfig";

const env = process.env;
afterEach(() => { delete env.AI_MODEL; delete env.AI_MODEL_LITE; delete env.AI_MODEL_ALT; });

describe("AI 연결 설정 (한 곳에서 주소·모델)", () => {
  it("환경변수가 없으면 지금까지 쓰던 기본 모델과 게이트웨이를 쓴다", () => {
    expect(AI_GATEWAY_URL).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(aiModel()).toBe(AI_MODEL_DEFAULTS.main);
    expect(aiModel("lite")).toBe("google/gemini-3.1-flash-lite");
    expect(aiModel("alt")).toBe("openai/gpt-6-astra");
  });

  it("단계별 환경변수로 모델을 바꾼다", () => {
    env.AI_MODEL = "google/gemma-4-27b";
    env.AI_MODEL_LITE = "openai/gpt-oss-20b";
    expect(aiModel("main")).toBe("google/gemma-4-27b");
    expect(aiModel("lite")).toBe("openai/gpt-oss-20b");
    expect(aiModel("alt")).toBe(AI_MODEL_DEFAULTS.alt);
  });

  it("꼴이 맞지 않는 값은 무시하고 기본값을 쓴다 (잘못 넣어 모든 AI 기능이 멈추지 않게)", () => {
    env.AI_MODEL = "gemini 3.8";
    env.AI_MODEL_LITE = "  ";
    expect(aiModel("main")).toBe(AI_MODEL_DEFAULTS.main);
    expect(aiModel("lite")).toBe(AI_MODEL_DEFAULTS.lite);
  });
});
