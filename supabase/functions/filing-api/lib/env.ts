// 에이프 서버 모듈은 process.env 로 설정을 읽는다. Deno 에서도 같은 코드가 돌도록 Deno.env 를 그 자리에 둔다 (가장 먼저 import 할 것)
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
if (!g.process) g.process = { env: Deno.env.toObject() };
else if (!g.process.env) g.process.env = Deno.env.toObject();

// Lovable Cloud 가 관리하는 키(LOVABLE_API_KEY 등)는 Deno.env.toObject() 목록에 빠질 수 있어
// 쓰는 키는 Deno.env.get 으로 한 번 더 채운다 (없으면 서버 AI 가 꺼진 것으로 보인다).
for (const key of ["LOVABLE_API_KEY", "KIPRIS_API_KEY", "KIPRIS_MOCK", "DATA_GO_KR_SERVICE_KEY"]) {
  if (!g.process.env[key]) {
    const v = Deno.env.get(key);
    if (v) g.process.env[key] = v;
  }
}
