// 운영용 빌드(vite preview)를 실제 브라우저로 열어 보는 자동 점검. CI가 배포 전마다 돌린다.
//   node scripts/smoke.mjs http://127.0.0.1:4173
// - 바깥 요청(Supabase·KIPRIS·영상 등)은 막는다: 서버 상태와 상관없이 같은 결과가 나오고, 서버가 안 될 때도 화면이 깨지지 않는지 본다.
// - 화면마다: 페이지 오류(잡히지 않은 예외)가 없고, 제목(h1)이 보이고, 가로로 넘치지 않는지 (데스크톱·휴대폰 폭).
// - 출원도우미(public/filing-app): 연습 시나리오로 1~5단계의 모든 쪽을 돌고, 기본 명세서·빈칸 질문·제출용 묶음 파일을 만든다.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");
const ROUTES = ["/", "/finder", "/potential", "/filing", "/insights", "/batch", "/compare", "/tech-videos", "/search?keyword=%EB%B0%9C%ED%9A%A8", "/no-such-page"];
const WIDTHS = [1280, 390];
const fails = [];
const fail = (where, msg) => { fails.push(`${where}: ${msg}`); console.log(`  ✗ ${msg}`); };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const local = new URL(BASE).origin;
async function page(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  await ctx.route("**/*", (r) => (r.request().url().startsWith(local) ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message.slice(0, 200)));
  p.on("dialog", (d) => d.accept());
  return p;
}

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    const where = `${route} @${width}px`;
    console.log(where);
    const p = await page(width);
    try {
      await p.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
      await p.locator("h1").first().waitFor({ timeout: 15000 });
      await p.waitForTimeout(800);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 2) fail(where, `가로로 ${over}px 넘침`);
    } catch (e) {
      fail(where, `열리지 않음: ${String(e.message).split("\n")[0]}`);
    }
    for (const e of p.errors) fail(where, `페이지 오류: ${e}`);
    await p.context().close();
  }
}

// 출원도우미: 연습 시나리오로 모든 단계를 돈다 (AI·KIPRIS 요청은 막혀 있어 예시 데이터·기본 초안으로 동작해야 한다)
{
  const where = "출원도우미";
  console.log(where);
  const p = await page(1280);
  try {
    await p.goto(`${BASE}/filing-app/index.html#idea`, { waitUntil: "load" });
    await p.waitForFunction(() => typeof window.startPractice === "function");
    const pages = await p.evaluate(() => {
      startPractice(4242);
      const out = [];
      for (const st of ["idea", "prior", "diag", "draft", "manage"]) (pagesFor(st) || [[0]]).forEach((_, k) => { goPage(st, k); out.push(`${st}:${k}`); });
      return out;
    });
    console.log(`  쪽 ${pages.length}개: ${pages.join(" ")}`);
    await p.evaluate(() => {
      goPage("draft", 1);
      const basic = [...document.querySelectorAll("button")].find((b) => /기본 초안 만들고 보기/.test(b.textContent));
      basic?.click();
    });
    // 빈칸 질문 카드는 명세서 점검과 함께 조금 뒤에 그려진다
    await p.waitForFunction(() => !specNeeds().length || document.querySelector("#qa-card #qa-q"), null, { timeout: 5000 }).catch(() => {});
    const r = await p.evaluate(() => ({ spec: S.spec?.text?.length ?? 0, needs: specNeeds().length, qa: !!document.querySelector("#qa-card #qa-q"), title: S.idea.title, eng: S.app.engTitle }));
    if (r.spec < 1500) fail(where, `명세서가 너무 짧음 (${r.spec}자)`);
    if (r.needs && !r.qa) fail(where, "빈칸이 있는데 빈칸 질문 카드가 없음");
    if (!/^[A-Z0-9 ,.;:()'&-]+$/.test(r.eng)) fail(where, `연습 영문 명칭이 이상함: ${r.eng}`);
    console.log(`  명세서 ${r.spec}자 · 빈칸 ${r.needs}곳 · ${r.title} / ${r.eng}`);
    await p.evaluate(() => goPage("draft", 4));
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.locator("#save-package").click()]);
    const path = await dl.path();
    const size = path ? (await import("node:fs")).statSync(path).size : 0;
    if (size < 10000) fail(where, `제출용 묶음 파일이 너무 작음 (${size}B)`);
    console.log(`  제출용 묶음 ${dl.suggestedFilename()} ${size}B`);
  } catch (e) {
    fail(where, `진행 중 멈춤: ${String(e.message).split("\n")[0]}`);
  }
  for (const e of p.errors) fail(where, `페이지 오류: ${e}`);
  await p.context().close();
}

await browser.close();
if (fails.length) {
  console.error(`\n자동 점검 실패 ${fails.length}건\n${fails.map((f) => `- ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\n자동 점검 통과");
