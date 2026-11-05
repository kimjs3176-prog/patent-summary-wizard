// scripts/lovable-deploy-list.mjs — Lovable 에서 다시 배포할 함수·마이그레이션 찾기
import { describe, expect, it } from "vitest";
import { planDeploy, lovablePrompt, render } from "../../scripts/lovable-deploy-list.mjs";

const graph = {
  functions: { "fetch-patent": ["kipris.ts"], "summarize-patent": ["patentSource.ts"], "filing-api": [] },
  shared: { "kipris.ts": ["http.ts"], "http.ts": [], "patentSource.ts": ["supabaseAdmin.ts"], "supabaseAdmin.ts": [] },
};

describe("lovable deploy list", () => {
  it("lists a function whose own files changed", () => {
    expect(planDeploy(["supabase/functions/filing-api/lib/draft.js", "src/App.tsx"], graph).functions).toEqual(["filing-api"]);
  });

  it("follows _shared imports, including indirect ones", () => {
    expect(planDeploy(["supabase/functions/_shared/http.ts"], graph).functions).toEqual(["fetch-patent"]);
    expect(planDeploy(["supabase/functions/_shared/supabaseAdmin.ts"], graph).functions).toEqual(["summarize-patent"]);
  });

  it("collects migrations and builds one Lovable prompt", () => {
    const plan = planDeploy(["supabase/migrations/2_b.sql", "supabase/migrations/1_a.sql", "supabase/functions/fetch-patent/index.ts"], graph);
    expect(plan.migrations).toEqual(["1_a.sql", "2_b.sql"]);
    expect(lovablePrompt(plan)).toContain("1_a.sql, 2_b.sql");
    expect(lovablePrompt(plan)).toContain("fetch-patent");
  });

  it("says Publish is enough when only the screen changed", () => {
    const plan = planDeploy(["src/pages/Index.tsx", "public/filing-app/index.html"], graph);
    expect(plan).toEqual({ functions: [], migrations: [], config: false });
    expect(render(plan)).toContain("Publish");
  });
});
