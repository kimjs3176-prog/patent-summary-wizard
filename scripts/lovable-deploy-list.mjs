#!/usr/bin/env node
// Lovable Cloud 는 GitHub 로 들어온 Edge Function·마이그레이션 변경을 자동으로 배포하지 않는다(Lovable 문서 'Git sync').
// 이 스크립트는 두 커밋 사이에서 다시 배포할 함수와 새로 적용할 마이그레이션을 찾아, Lovable 채팅에 붙여 넣을 문장까지 만든다.
//   node scripts/lovable-deploy-list.mjs <base> [head]      예) node scripts/lovable-deploy-list.mjs origin/main HEAD
//   --markdown 을 붙이면 GitHub Actions 요약(GITHUB_STEP_SUMMARY)용 마크다운으로 낸다.
// _shared/ 파일이 바뀌면 그 파일을 (직접·간접으로) 가져다 쓰는 함수를 모두 배포 대상으로 넣는다.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FN_DIR = "supabase/functions";
const MIGRATION_DIR = "supabase/migrations";
const SHARED = "_shared";

/** 함수·공유 파일의 _shared 의존 관계를 읽는다: { functions: {fn: [shared…]}, shared: {file: [shared…]} } */
export function scanImports(root) {
  const fnRoot = join(root, FN_DIR);
  const sharedOf = (text, fromShared) => {
    const out = new Set();
    const re = fromShared ? /from\s+["']\.\/([^"']+)["']/g : /["'](?:\.\.\/)+_shared\/([^"']+)["']/g;
    for (const m of text.matchAll(re)) out.add(m[1]);
    return [...out];
  };
  const filesUnder = dir => readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === "node_modules" ? [] : filesUnder(p)) : /\.(ts|js|mjs|tsx)$/.test(n) ? [p] : [];
  });
  const functions = {}, shared = {};
  for (const name of readdirSync(fnRoot)) {
    const dir = join(fnRoot, name);
    if (!statSync(dir).isDirectory()) continue;
    if (name === SHARED) {
      for (const f of filesUnder(dir)) shared[relative(dir, f)] = sharedOf(readFileSync(f, "utf8"), true);
    } else {
      functions[name] = [...new Set(filesUnder(dir).flatMap(f => sharedOf(readFileSync(f, "utf8"), false)))];
    }
  }
  return { functions, shared };
}

/** 바뀐 경로 목록 → { functions: 배포할 함수(이름순), migrations: 새·바뀐 마이그레이션, config: config.toml 변경 여부 } */
export function planDeploy(changed, graph) {
  const fns = new Set(), sharedChanged = new Set(), migrations = [];
  let config = false;
  for (const p of changed) {
    if (p === "supabase/config.toml") config = true;
    else if (p.startsWith(`${MIGRATION_DIR}/`) && p.endsWith(".sql")) migrations.push(p.slice(MIGRATION_DIR.length + 1));
    else if (p.startsWith(`${FN_DIR}/${SHARED}/`)) sharedChanged.add(p.slice(`${FN_DIR}/${SHARED}/`.length));
    else if (p.startsWith(`${FN_DIR}/`)) {
      const name = p.slice(FN_DIR.length + 1).split("/")[0];
      if (name && graph.functions[name]) fns.add(name);
    }
  }
  // 공유 파일을 간접으로 쓰는 경우까지 펼친다
  const reaches = new Map();
  const reach = file => {
    if (reaches.has(file)) return reaches.get(file);
    const seen = new Set([file]);
    reaches.set(file, seen);
    for (const dep of graph.shared[file] ?? []) for (const x of reach(dep)) seen.add(x);
    return seen;
  };
  if (sharedChanged.size) {
    for (const [fn, deps] of Object.entries(graph.functions)) {
      if (deps.some(d => [...reach(d)].some(x => sharedChanged.has(x)))) fns.add(fn);
    }
  }
  return { functions: [...fns].sort(), migrations: migrations.sort(), config };
}

/** Lovable 채팅에 그대로 붙여 넣을 문장 */
export function lovablePrompt(plan) {
  const parts = [];
  if (plan.migrations.length) parts.push(`supabase/migrations 의 새 마이그레이션 ${plan.migrations.join(", ")} 을(를) 순서대로 적용해 줘.`);
  if (plan.functions.length) parts.push(`Edge Function ${plan.functions.join(", ")} 을(를) GitHub 의 최신 코드로 다시 배포해 줘.`);
  if (plan.config && !plan.functions.length) parts.push("supabase/config.toml 설정이 바뀌었으니 관련 Edge Function 을 다시 배포해 줘.");
  return parts.join(" ");
}

export function render(plan, { markdown = false } = {}) {
  const prompt = lovablePrompt(plan);
  if (!prompt) return markdown ? "### Lovable 배포\n\n배포할 Edge Function·마이그레이션이 없습니다. 화면 변경은 Lovable 에서 **Publish** 만 하면 됩니다.\n" : "배포할 Edge Function·마이그레이션 없음 (화면은 Publish 만)";
  if (!markdown) return [
    plan.migrations.length ? `마이그레이션: ${plan.migrations.join(", ")}` : "",
    plan.functions.length ? `배포할 함수: ${plan.functions.join(", ")}` : "",
    `Lovable 에 붙여 넣기: ${prompt}`
  ].filter(Boolean).join("\n");
  return [
    "### Lovable 배포",
    "",
    "Lovable Cloud 는 GitHub 로 들어온 함수·마이그레이션을 자동 배포하지 않습니다. 병합 뒤 Lovable 채팅에 아래 문장을 붙여 넣고, 화면은 **Publish** 하세요.",
    "",
    plan.migrations.length ? `- 마이그레이션: ${plan.migrations.map(m => `\`${m}\``).join(", ")}` : "",
    plan.functions.length ? `- 배포할 함수: ${plan.functions.map(f => `\`${f}\``).join(", ")}` : "",
    "",
    "```text",
    prompt,
    "```",
    ""
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const markdown = args.includes("--markdown");
  const [base, head = "HEAD"] = args.filter(a => !a.startsWith("--"));
  if (!base) { console.error("사용법: node scripts/lovable-deploy-list.mjs <base> [head] [--markdown]"); process.exit(2); }
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const changed = execFileSync("git", ["-C", root, "diff", "--name-only", `${base}...${head}`], { encoding: "utf8" }).split("\n").filter(Boolean);
  console.log(render(planDeploy(changed, scanImports(root)), { markdown }));
}
