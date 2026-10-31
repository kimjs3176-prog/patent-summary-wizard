// 에이프 서버 모듈은 process.env 로 설정을 읽는다. Deno 에서도 같은 코드가 돌도록 Deno.env 를 그 자리에 둔다 (가장 먼저 import 할 것)
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
if (!g.process) g.process = { env: Deno.env.toObject() };
else if (!g.process.env) g.process.env = Deno.env.toObject();
