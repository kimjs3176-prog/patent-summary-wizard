// 운영용 빌드(vite preview)를 실제 브라우저로 열어 보는 자동 점검. CI가 배포 전마다 돌린다.
//   node scripts/smoke.mjs http://127.0.0.1:4173
// - 바깥 요청(Supabase·KIPRIS·영상 등)은 막는다: 서버 상태와 상관없이 같은 결과가 나오고, 서버가 안 될 때도 화면이 깨지지 않는지 본다.
// - 화면마다: 페이지 오류(잡히지 않은 예외)가 없고, 제목(h1)이 보이고, 가로로 넘치지 않는지 (데스크톱·휴대폰 폭).
// - 출원도우미(public/filing-app): 연습 시나리오로 1~5단계의 모든 쪽을 돌고, 기본 명세서·빈칸 질문·제출용 묶음 파일을 만든 뒤 넘어가기 전 점검 팝업을 거쳐 5단계로 간다.
// - 출원도우미 1단계: 사전 질문(대화)에 화면에서 차례로 답하고, 초안 고르기 쪽의 절차를 하나씩 연 뒤 2단계로 넘어간다.
// - 요약서(데이터시트형): scripts/fixtures 의 저장된 서버 응답으로 띄워, 인쇄와 PDF 다운로드가 정확히 A4 두 쪽인지 본다.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");
const ROUTES = ["/", "/finder", "/potential", "/consortium", "/consortium?org=%ED%95%9C%EA%B5%AD%EC%8B%9D%ED%92%88%EC%97%B0%EA%B5%AC%EC%9B%90", "/filing", "/insights", "/batch", "/compare", "/tech-videos", "/search?keyword=%EB%B0%9C%ED%9A%A8", "/no-such-page"];
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
    // 손으로 고친 값: 명칭을 바꾸면 검색어가 따라가고, 수치 범위의 단위·속성(직경 등)은 청구항에 맞게 읽는다
    const hand = await p.evaluate(() => ({ kw: kwFromTitle("블루베리 선도 유지용 통기 포장 용기"), a: parsePart("직경 0.2~0.5 mm 미세 천공부"), b: parsePart("제올라이트 흡습 패드 3~8 g") }));
    if (hand.kw !== "블루베리\n포장\n용기") fail(where, `명칭에서 뽑은 검색어가 이상함: ${JSON.stringify(hand.kw)}`);
    if (hand.a.name !== "미세 천공부" || hand.a.attr !== "직경" || hand.b.name !== "제올라이트 흡습 패드" || hand.b.ranges[0] !== "3~8 g") fail(where, `구성 수치 읽기가 이상함: ${JSON.stringify([hand.a, hand.b])}`);
    // 진단 쪽에서 바로 고치기: 카드 안에 고칠 칸이 열린다 (다른 쪽으로 가지 않는다)
    await p.evaluate(() => goPage("diag", 0));
    const rq = p.locator("[data-rq-open]");
    if (await rq.count()) {
      await rq.first().click();
      const ed = await p.evaluate(() => ({ step: S.step, edit: !!document.querySelector(".req-edit [data-rq-apply]") }));
      if (ed.step !== "diag" || !ed.edit) fail(where, `진단 쪽에서 바로 고칠 칸이 열리지 않음: ${JSON.stringify(ed)}`);
    }
    // 실험 데이터 도우미: 기록지(CSV)를 받아 값을 채워 올리면 그래프 입력표로 들어간다
    const sheet = await p.evaluate(() => { const csv = expSheetCsv().replace(/,,(?=\r\n|$)/g, ",5,0.1"); const gs = importExpSheet(csv); return { n: gs.length, v: gs[0]?.rows?.[0]?.val }; });
    if (!sheet.n || !sheet.v) fail(where, `실험 기록지를 올려도 값이 들어가지 않음: ${JSON.stringify(sheet)}`);
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
    // 넘어가기 전 점검: 빈칸이 남은 채 ‘다음’을 누르면 팝업이 남은 일을 보여 주고, ‘그래도 다음으로’로 넘어간다
    await p.locator("#pagebar [data-nav=next]").click();
    const leave = await p.evaluate(() => ({ needs: specNeeds().length, shown: !document.querySelector("#leave").hidden, items: document.querySelectorAll("#leave [data-leave-go]").length }));
    if (leave.needs && (!leave.shown || !leave.items)) fail(where, `빈칸이 남았는데 넘어가기 전 점검 팝업이 없음: ${JSON.stringify(leave)}`);
    if (leave.shown) await p.locator("[data-leave-skip]").click();
    const after = await p.evaluate(() => S.step);
    if (after !== "manage") fail(where, `‘그래도 다음으로’ 뒤 5단계로 넘어가지 않음 (${after})`);
    console.log(`  넘어가기 전 점검 ${leave.items}건 · ${after}`);
  } catch (e) {
    fail(where, `진행 중 멈춤: ${String(e.message).split("\n")[0]}`);
  }
  for (const e of p.errors) fail(where, `페이지 오류: ${e}`);
  await p.context().close();
}

// 출원도우미 1단계: 사전 질문에 화면에서 차례로 답하고(질문은 하나씩 열린다, 다음에 누를 곳 안내가 따라온다), 초안 고르기 쪽의 절차를 하나씩 연 뒤 2단계로 넘어간다
{
  const where = "출원도우미 사전 질문";
  console.log(where);
  const p = await page(390);
  try {
    await p.goto(`${BASE}/filing-app/index.html#idea`, { waitUntil: "load" });
    await p.waitForFunction(() => typeof chatCur === "function" && document.querySelector("#f-chat"));
    const pick = (name, value) => p.locator(`label:has(input[name="${name}"][value="${value}"])`).click();
    // 첫 질문은 평소 말투의 문장: 규칙으로 분야·낱말·발명 유형을 읽는다
    const read = await p.evaluate(() => ({ a: analyzePitch("비행하는 트랙터를 만들거야"), b: analyzePitch("쌀겨를 발효해서 액상 비료를 만들고 싶어요") }));
    if (read.a.field !== "smartfarm" || read.a.kind !== "device" || read.a.obj !== "트랙터" || read.a.feat !== "비행") fail(where, `문장 읽기가 이상함: ${JSON.stringify(read.a)}`);
    if (read.b.field !== "ferment" || !read.b.kws.includes("쌀겨") || !read.b.kws.includes("비료")) fail(where, `문장 읽기가 이상함: ${JSON.stringify(read.b)}`);
    await p.locator("#idea-pitch").fill("곡물로 만든 저염 간편식을 만들고 싶어요");
    await p.locator('[data-chat-ok="idea"]').click();
    const guessed = await p.evaluate(() => [S.idea.field, S.ideate.kw]);
    if (guessed[0] !== "food" || !/곡물/.test(guessed[1])) fail(where, `문장으로 정한 분야·낱말이 이상함: ${guessed}`);
    await p.locator("#ideate-run").click();
    await pick("pick-problem", "1");
    await p.locator('[data-chat-ok="problem"]').click();
    await pick("data", "yes");
    await pick("sold", "no");
    await pick("disclosed", "no");
    const left = await p.evaluate(() => chatCur()?.id ?? "");
    if (left) fail(where, `질문이 남음: ${left}`);
    const bubbles = await p.locator(".chat-a").count();
    if (bubbles < 5) fail(where, `답 말풍선이 ${bubbles}개뿐`);
    if ((await p.locator(".chat-nav .done").count()) < 5) fail(where, "질문 진행 칩이 답한 질문을 보여 주지 않음");
    // 다음에 누를 곳 안내: 질문을 다 답하면 아래 막대의 ‘다음’을 가리킨다
    await p.waitForFunction(() => !document.querySelector("#nh-tip").hidden && NH.el?.matches?.('#pagebar [data-nav="next"]'), null, { timeout: 3000 }).catch(() => {});
    const hint = await p.evaluate(() => ({ shown: !document.querySelector("#nh-tip").hidden, next: !!NH.el?.matches?.('#pagebar [data-nav="next"]') }));
    if (!hint.shown || !hint.next) fail(where, `다음 누를 곳 안내가 ‘다음’ 버튼을 가리키지 않음: ${JSON.stringify(hint)}`);
    await p.locator("#pagebar [data-nav=next]").click();
    let opened = 0;
    for (; opened < 6; opened++) {
      const go = p.locator(".sw-cut:not([hidden]) [data-sw-go]");
      if (!(await go.count())) break;
      await go.first().click();
    }
    const st = await p.evaluate(() => ({ pg: pagesFor(S.step)[S.sub]?.[0], diff: !!document.querySelector("#diff")?.getClientRects().length, chips: document.querySelectorAll("[data-pick-set]").length }));
    if (st.pg !== "pick" || !st.diff || !st.chips || opened < 2) fail(where, `초안 고르기 절차가 다 열리지 않음 (${JSON.stringify(st)}, 연 절차 ${opened}개)`);
    await p.locator("#pagebar [data-nav=next]").click();
    const step = await p.evaluate(() => S.step);
    if (step !== "prior") fail(where, `2단계로 넘어가지 않음 (${step})`);
    console.log(`  답 ${bubbles}개 · 연 절차 ${opened}개 · ${step}`);
  } catch (e) {
    fail(where, `진행 중 멈춤: ${String(e.message).split("\n")[0]}`);
  }
  for (const e of p.errors) fail(where, `페이지 오류: ${e}`);
  await p.context().close();
}

// 요약서: 인쇄·PDF 다운로드가 A4 정확히 두 쪽 (데이터시트형 레이아웃이 깨지면 여기서 걸린다)
{
  const where = "요약서 2쪽";
  console.log(where);
  const fs = await import("node:fs");
  const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/summary-10-2080834.json", import.meta.url), "utf8"));
  const pageCount = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  const p = await page(1280);
  // 바깥 요청은 막은 채, 요약서에 필요한 함수 응답만 저장본으로 돌려준다 (나중에 등록한 route가 먼저 잡는다)
  await p.context().route(/\/functions\/v1\/([a-z-]+)/, (r) => {
    const name = r.request().url().match(/\/functions\/v1\/([a-z-]+)/)[1];
    if (name === "proxy-image") return r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(fx.figurePng, "base64") });
    const f = fx.functions[name];
    return f ? r.fulfill({ status: f.status, contentType: f.contentType, body: f.body }) : r.abort();
  });
  // 휴대폰처럼 인쇄 창을 띄우자마자 돌아오는 window.print: 인쇄 상태가 그대로 남아 있어야 한다
  await p.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  try {
    await p.goto(`${BASE}/?patent=${fx.patent}`, { waitUntil: "load", timeout: 30000 });
    await p.waitForFunction(() => document.querySelectorAll(".ds-sheet").length === 2 && document.querySelectorAll(".ds-text").length >= 5 && !document.querySelector(".ds .animate-spin"), null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    await p.locator("button:has-text('인쇄')").first().click();
    await p.waitForFunction(() => window.__printed > 0, null, { timeout: 15000 });
    const st = await p.evaluate(() => ({ printing: document.body.classList.contains("ais-printing"), free: document.querySelectorAll(".ds-free").length, scale: [...document.querySelectorAll(".ds-sheet")].map((s) => s.style.getPropertyValue("--ds-scale") || "1") }));
    if (!st.printing) fail(where, "인쇄 버튼을 눌렀는데 요약서만 남기는 인쇄 상태가 아님");
    if (st.free) fail(where, `글자를 78%까지 줄여도 한 쪽에 안 들어가는 면이 ${st.free}개`);
    await p.emulateMedia({ media: "print" });
    const printed = pageCount(await p.pdf({ preferCSSPageSize: true, printBackground: true }));
    await p.emulateMedia({ media: "screen" });
    await p.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    if (printed !== 2) fail(where, `인쇄가 ${printed}쪽 (2쪽이어야 함)`);
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.locator("button:has-text('PDF 다운로드')").first().click()]);
    const downloaded = pageCount(fs.readFileSync(await dl.path()));
    if (downloaded !== 2) fail(where, `PDF 다운로드가 ${downloaded}쪽 (2쪽이어야 함)`);
    console.log(`  인쇄 ${printed}쪽 · PDF 다운로드 ${downloaded}쪽 · 글자 배율 ${st.scale.join(", ")}`);
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
