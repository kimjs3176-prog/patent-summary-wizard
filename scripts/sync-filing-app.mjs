#!/usr/bin/env node
// 출원지원을 에이프 저장소(koat-axlab)에서 가져온다 — 명령 한 번으로 AIS 쪽 사본을 갱신한다.
//   node scripts/sync-filing-app.mjs ../koat-axlab
//   1) 화면: koat-axlab/scripts/build-filing-app.mjs 로 출원지원만 남긴 한 파일을 만들어 public/filing-app/index.html 에 둔다
//      (API 주소는 .env 의 VITE_SUPABASE_URL + /functions/v1/filing-api)
//   2) API: koat-axlab/server/*.js 를 supabase/functions/filing-api/lib/ 로 복사한다 (http.js 는 Node 전용, publicdata.js 는 수출 실적·공고·기사용이라 뺀다)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(process.argv[2] || resolve(ROOT, "../koat-axlab"));
const env = Object.fromEntries(readFileSync(resolve(ROOT, ".env"), "utf8").split("\n").filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const api = process.argv.includes("--api") ? process.argv[process.argv.indexOf("--api") + 1] : `${env.VITE_SUPABASE_URL}/functions/v1/filing-api`;
if (!/^https?:\/\//.test(api)) throw new Error(`API 주소가 이상합니다: ${api}`);

const { buildFilingApp } = await import(pathToFileURL(resolve(src, "scripts/build-filing-app.mjs")).href);
const html = buildFilingApp(readFileSync(resolve(src, "index.html"), "utf8"), { api });
mkdirSync(resolve(ROOT, "public/filing-app"), { recursive: true });
writeFileSync(resolve(ROOT, "public/filing-app/index.html"), html);

const lib = resolve(ROOT, "supabase/functions/filing-api/lib");
mkdirSync(lib, { recursive: true });
const files = readdirSync(resolve(src, "server")).filter(f => f.endsWith(".js") && !["server.js", "http.js", "publicdata.js"].includes(f));
for (const old of ["publicdata.js"]) { try { unlinkSync(resolve(lib, old)); } catch { /* 없으면 그만 */ } }
for (const f of files) copyFileSync(resolve(src, "server", f), resolve(lib, f));
writeFileSync(resolve(lib, "SOURCE.md"), `에이프(koat-axlab) server/ 의 사본입니다. 직접 고치지 말고 원본을 고친 뒤 \`node scripts/sync-filing-app.mjs\` 로 다시 가져오세요.\n원본 커밋: ${(() => { try { return readFileSync(resolve(src, ".git/HEAD"), "utf8").trim(); } catch { return "?"; } })()}\n파일: ${files.join(", ")}\n`);
console.log(`public/filing-app/index.html ${(html.length / 1024).toFixed(0)} KB (API ${api})\nsupabase/functions/filing-api/lib: ${files.join(", ")}`);
