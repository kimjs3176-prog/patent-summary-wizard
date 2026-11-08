// 운영용 빌드(vite preview)를 실제 브라우저로 열어 보는 자동 점검. CI가 배포 전마다 돌린다.
//   node scripts/smoke.mjs http://127.0.0.1:4173
// - 바깥 요청(Supabase·KIPRIS·영상 등)은 막는다: 서버 상태와 상관없이 같은 결과가 나오고, 서버가 안 될 때도 화면이 깨지지 않는지 본다.
// - 화면마다: 페이지 오류(잡히지 않은 예외)가 없고, 제목(h1)이 보이고, 가로로 넘치지 않는지 (데스크톱·휴대폰 폭).
// - 출원도우미를 처음 열 때 결과물이 출원·등록을 보장하지 않는다는 안내가 (AIS 화면·단독 화면에서) 한 번 뜨고 닫히는지.
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

// 출원도우미를 처음 열 때 결과물이 출원·등록을 보장하지 않는다는 안내가 뜨고, 확인하면 같은 탭에서는 다시 뜨지 않는다.
// AIS 화면(/filing)이 띄우고 그 안의 iframe 은 띄우지 않는다. 단독 화면은 자동 점검 브라우저에서 숨기므로 __noticeForce 로 확인한다.
{
  const where = "출원 면책 안내";
  console.log(where);
  const p = await page(390);
  const said = /출원이나 등록을 보장하지 않아요/;
  try {
    await p.addInitScript(() => { window.__noticeForce = true; });
    await p.goto(`${BASE}/filing`, { waitUntil: "load" });
    const dlg = p.locator("[data-filing-notice]");
    await dlg.waitFor({ timeout: 15000 });
    if (!said.test(await dlg.innerText())) fail(where, "AIS 화면 안내에 '출원이나 등록을 보장하지 않아요'가 없음");
    const inner = p.frames().find((f) => f.url().includes("/filing-app/"));
    if (!inner) fail(where, "출원도우미 iframe 이 없음");
    else {
      await inner.waitForFunction(() => typeof window.startPractice === "function", null, { timeout: 15000 });
      if (await inner.evaluate(() => !document.querySelector("#notice")?.hidden)) fail(where, "iframe 안에서도 안내가 떠 두 번 보임");
    }
    await dlg.getByRole("button", { name: "확인했어요" }).click();
    await dlg.waitFor({ state: "detached", timeout: 5000 });
    await p.reload({ waitUntil: "load" });
    await p.locator("h1").first().waitFor({ timeout: 15000 });
    await p.waitForTimeout(800);
    if (await p.locator("[data-filing-notice]").count()) fail(where, "확인한 뒤 같은 탭에서 다시 뜸");
    await p.evaluate(() => sessionStorage.clear());
    await p.goto(`${BASE}/filing-app/index.html#idea`, { waitUntil: "load" });
    const box = p.locator("#notice:not([hidden])");
    await box.waitFor({ timeout: 10000 });
    if (!said.test(await box.innerText())) fail(where, "단독 화면 안내에 '출원이나 등록을 보장하지 않아요'가 없음");
    await box.getByRole("button", { name: "확인했어요" }).click();
    if (!(await p.locator("#notice").isHidden())) fail(where, "단독 화면: '확인했어요'를 눌러도 닫히지 않음");
    await p.reload({ waitUntil: "load" });
    await p.waitForFunction(() => typeof window.startPractice === "function");
    await p.waitForTimeout(400);
    if (await p.locator("#notice").isVisible()) fail(where, "단독 화면: 확인한 뒤 같은 탭에서 다시 뜸");
    console.log("  AIS 화면·단독 화면 모두 한 번 뜨고 닫힘");
  } catch (e) {
    fail(where, String(e.message).split("\n")[0]);
  }
  for (const e of p.errors) fail(where, `페이지 오류: ${e}`);
  await p.context().close();
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
    // 수치 표기 시험표: 중량부·전각 물결·wt%·L/min·mesh·‘분간’·이하·±·비율·기준값 조건을 한 덩어리로 읽어 이름에 조각이 남지 않는다 [입력, 이름, 범위(청구항 표기)]
    const nums = await p.evaluate(() => [
      ["쌀가루 50~70중량부", "쌀가루", "50 내지 70 중량부"], ["쌀겨 발효물 10～30 중량%", "쌀겨 발효물", "10 내지 30 중량%"], ["쌀겨 발효물 10 ~ 30 wt%", "쌀겨 발효물", "10 내지 30 중량%"],
      ["유량 1~5 L/min 양액 공급 펌프", "양액 공급 펌프", "1 내지 5 L/min"], ["10-20 mesh 분쇄물", "분쇄물", "10 내지 20 mesh"], ["120℃에서 15분간 살균하는 단계", "살균하는 단계", "120℃|15분"],
      ["60℃에서 2시간 건조", "건조", "60℃|2시간"], ["수분 함량 40% 이하", "수분", "40% 이하"], ["증숙한 고구마를 60℃ 이상에서 12시간 건조하는 단계", "증숙한 고구마를 건조하는 단계", "60℃ 이상|12시간"],
      ["건조물을 25±2℃에서 숙성하는 단계", "건조물을 숙성하는 단계", "25±2℃"], ["혼합비 1:1~1:3으로 시럽과 혼합하는 단계", "시럽과 혼합하는 단계", "혼합비 1:1 내지 1:3"],
      ["증자한 대두 100 중량부에 들깨박 5~15 중량부를 혼합하는 단계", "증자한 대두에 들깨박을 혼합하는 단계", "대두 100 중량부|들깨박 5 내지 15 중량부"],
      ["염도 8~10%의 염수에 담가 60~90일 숙성하는 단계", "염수에 담가 숙성하는 단계", "염도 8 내지 10%|60 내지 90일"],
      ["토양 수분이 25% 이하이면 전자 밸브를 여는 제어부", "토양 수분이 소정의 기준값 이하이면 전자 밸브를 여는 제어부", "25%"],
      ["50% 에탄올로 60℃에서 추출하는 단계", "에탄올로 추출하는 단계", "50%|60℃"], ["−18℃ 이하로 냉동하는 단계", "냉동하는 단계", "-18℃ 이하"],
      ["유산균 10^6~10^8 CFU/mL", "유산균", "10^6 내지 10^8 CFU/mL"], ["A와 B의 중량비 1:1~1:3", "A와 B의 중량비 1:1~1:3", ""],
    ].map(([raw, name, r]) => { const x = parsePart(raw), got = x.ranges.map(rangeKo).join("|"); return x.name === name && got === r && x.step === /단계$|건조$/.test(raw) ? "" : `${raw} → ${x.name} / ${got} / 단계 ${x.step}`; }).filter(Boolean));
    if (nums.length) fail(where, `수치 표기 읽기가 이상함: ${nums.join(" · ")}`);
    // 명칭으로 정하는 발명 종류·서류 틀: ‘및’은 범주 낱말이나 ‘그·이를’ 앞에서만 나누고, 장치 끝말(급이기·트레이·건조기…)은 장치 틀로 [명칭, 분야, 종류, 틀]
    const kinds = await p.evaluate(() => [["농산물 세척 및 건조 방법", "food", "method", "process"], ["비료 조성물 및 제조방법", "ferment", "product,method", "ferment"], ["고구마를 이용한 간식 및 그 제조방법", "food", "product,method", "food"],
      ["온도 및 습도 자동 제어 장치", "smartfarm", "device", "smartfarm"], ["축사 자동 급이기", "smartfarm", "device", "smartfarm"], ["육묘 트레이", "food", "device", "device"], ["곡물 건조기", "food", "device", "device"], ["딸기 품종 판별용 키트", "variety", "device", "variety"]]
      .map(([t, f, k, tpl]) => (claimKinds(t).all.join() === k && tplFor(f, t) === tpl ? "" : `${t} → ${claimKinds(t).all}/${tplFor(f, t)}`)).filter(Boolean));
    if (kinds.length) fail(where, `명칭으로 정한 발명 종류가 이상함: ${kinds.join(" · ")}`);
    // 연습 4242는 온라인 쇼핑몰 공개: 출원서·증명서류의 공개형태가 공개한 곳과 맞는다 (예전에는 늘 ‘박람회 출품’)
    const form = await p.evaluate(() => [buildApplicationForm().match(/【공개형태】 (.+)/)?.[1], buildDisclosureProof().match(/라\. 공개형태: (.+)/)?.[1]]);
    if (form.join() !== "인터넷 게시,인터넷 게시") fail(where, `연습 4242의 공개형태가 공개한 곳과 다름: ${form}`);
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
    // 연습 4242(전자 부품 없는 포장 용기): 제어부·통신 문단과 ‘블록도’ 대신 구조 문단과 구성도
    const box = await p.evaluate(() => ({ elec: /유선 또는 무선 통신|제어부는 프로세서/.test(S.spec.text), block: /블록도/.test(S.spec.text), shape: /일체로 성형되거나/.test(S.spec.text) }));
    if (box.elec || box.block || !box.shape) fail(where, `전자 부품 없는 장치에 제어부·블록도 문단이 들어감: ${JSON.stringify(box)}`);
    if (r.needs && !r.qa) fail(where, "빈칸이 있는데 빈칸 질문 카드가 없음");
    if (!/^[A-Z0-9 ,.;:()'&-]+$/.test(r.eng)) fail(where, `연습 영문 명칭이 이상함: ${r.eng}`);
    console.log(`  명세서 ${r.spec}자 · 빈칸 ${r.needs}곳 · ${r.title} / ${r.eng}`);
    // 쉬운 말 읽기: 법정 항목이 일상 질문 카드로 바뀌고, 빈칸은 눌러서 원문의 그 자리로 간다. 상담 요약서는 입력·진단을 모아 만든다
    const easy = await p.evaluate(() => {
      const sec = [...document.querySelectorAll("#spec-easy .easy-sec h4")].map((h) => h.firstChild.textContent);
      const chip = document.querySelector("#spec-easy .need-chip"); chip?.click();
      const ta = document.querySelector("#spec-text");
      return { shown: !document.querySelector("#spec-easy").hidden || S.specView === "raw", secs: sec.length, q: sec.includes("무엇을 해결하나요?"), chip: !!chip, raw: chip ? S.specView === "raw" && ta.value.slice(ta.selectionStart, ta.selectionStart + 6) === "〔입력 필요" : true, brief: consultBrief().length };
    });
    if (easy.secs < 5 || !easy.q || !easy.raw || easy.brief < 500) fail(where, `쉬운 말 읽기·상담 요약서가 이상함: ${JSON.stringify(easy)}`);
    console.log(`  쉬운 말 읽기 ${easy.secs}항목 · 상담 요약서 ${easy.brief}자`);
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
    // 보안: 저장된 작업을 되살릴 때 형식이 맞지 않는 비교 특허는 버리고, javascript: 링크는 만들지 않는다
    const sec = await p.evaluate(() => {
      const ok = restoreWork({ v: 1, idea: { title: "x" }, step: "prior", watch: [{ no: "<img src=x onerror=alert(1)>" }, { no: "1020200123456", title: "정상" }] });
      return { ok, watch: S.watch.map((w) => w.no), href: safeHref("javascript:alert(1)"), https: safeHref("https://doi.org/10.8080/1"), importUi: !!document.querySelector("[data-work-import], [data-work-export]") };
    });
    if (!sec.ok || sec.watch.join() !== "1020200123456" || sec.href || !sec.https || sec.importUi) fail(where, `저장 작업 되살리기·링크 검사가 이상함: ${JSON.stringify(sec)}`);
    // 시험표의 입력으로 기본 초안 청구항까지: 청구항 1은 수치 조각 없이 문장이 되고, 수치는 단위째 종속항으로 간다
    const claims = await p.evaluate(() => {
      const make = (title, field, parts) => { Object.assign(S.idea, { title, field }); S.parts = parts; S.tpl = tplFor(); const t = buildSpecTemplate(); return t.slice(t.indexOf("【청구항 1】"), t.indexOf("【요약서】")); };
      return [
        [make("쌀가루를 포함하는 저당 떡 조성물", "food", "쌀가루 50~70중량부\n알룰로스 10~20 중량부\n소금 1~2 g\n수분 함량 40% 이하"), ["쌀가루, 알룰로스, 소금 및 수분을 포함하는 저당 떡 조성물.", "상기 쌀가루는 50 내지 70 중량부로 포함되는", "상기 수분은 40% 이하로 포함되는"]],
        [make("고구마 말랭이의 제조방법", "food", "고구마를 100℃에서 30분간 증숙하는 단계\n증숙한 고구마를 60℃ 이상에서 12시간 건조하는 단계\n건조물을 25±2℃에서 숙성하는 단계\n혼합비 1:1~1:3으로 시럽과 혼합하는 단계"), ["(a) 고구마를 증숙하는 단계; (b) 증숙한 고구마를 건조하는 단계; (c) 건조물을 숙성하는 단계; 및 (d) 시럽과 혼합하는 단계를 포함하는", "60℃ 이상 및 12시간의 조건", "혼합비 1:1 내지 1:3의 조건"]],
        [make("토양 수분 센서를 구비한 점적 관수 장치", "smartfarm", "토양 수분 센서\n토양 수분이 25% 이하이면 전자 밸브를 여는 제어부\n전자 밸브"), ["토양 수분이 소정의 기준값 이하이면 전자 밸브를 여는 제어부", "제어부의 기준값은 25%인"]],
      ].flatMap(([text, want]) => want.filter((w) => !text.includes(w)).map((w) => `${w} ← ${text.split("\n")[1]}`));
    });
    if (claims.length) fail(where, `시험표 입력의 청구항이 이상함: ${claims.join(" · ")}`);
    // 서류 만들기 ✓ 기준: 출원서에 그대로 들어가는 국가R&D 칸(연구기간 등)이 비어 있으면 남은 일로 센다
    const rnd = await p.evaluate(() => { const was = { ...S.app }; Object.assign(S.app, { rnd: "yes", rndId: "1395012345", rndAgency: "농촌진흥청", rndTask: "과제", rndNo: "", rndMinistry: "", rndProgram: "", rndOrg: "", rndPeriod: "" }); const t = stepTodo("draft").map((x) => x.t).join(); Object.assign(S.app, was); return t; });
    if (!/꼭 채울 칸 5개/.test(rnd)) fail(where, `출원서 빈칸이 남았는데 서류 만들기 남은 일에 없음: ${rnd}`);
    // 빈칸 질문 ‘보조 소재로 정확히 무엇을 쓰나요?’의 답은 구성 이름을 바꾼다 (이름 뒤에 붙어 ‘보조 소재들깨분를’이 되지 않는다)
    const ren = await p.evaluate(() => {
      startPractice(118); S.spec = newTemplateSpec();
      const at = S.spec.text.search(/〔입력 필요: [^〕]*의 구체적인 물질명/);
      let ta = document.querySelector("#qa-answer"); const tmp = !ta; if (tmp) { ta = document.createElement("textarea"); ta.id = "qa-answer"; document.body.append(ta); }
      ta.value = "들깨분"; qaPut(at); if (tmp) ta.remove();
      const t = S.spec.text; return { at, c1: t.slice(t.indexOf("【청구항 1】") + 8).trim().split("\n")[0], part: S.parts.split("\n").includes("들깨분") };
    });
    if (ren.at < 0 || !/ 및 들깨분을 포함하는 /.test(ren.c1) || !ren.part) fail(where, `물질명 답이 구성 이름을 바꾸지 않음: ${JSON.stringify(ren)}`);
    const ren2 = await p.evaluate(() => {
      startPractice(13); S.spec = newTemplateSpec(); S.spec.edited = true;
      const at = S.spec.text.search(/〔입력 필요: 부형제의 구체적인 물질명/);
      let ta = document.querySelector("#qa-answer"); const tmp = !ta; if (tmp) { ta = document.createElement("textarea"); ta.id = "qa-answer"; document.body.append(ta); }
      ta.value = "말토덱스트린"; qaPut(at); if (tmp) ta.remove();
      const t = S.spec.text, c1 = t.slice(t.indexOf("【청구항 1】") + 8).trim().split("\n")[0];
      startPractice(75); S.spec = newTemplateSpec();
      return { at, list: /담체, 부형제, 희석제/.test(t), c1, todo: stepTodo("draft").map((x) => x.t).join() };
    });
    if (ren2.at < 0 || !ren2.list || !/ 및 말토덱스트린을 포함하는 /.test(ren2.c1) || /균주 입수/.test(ren2.todo)) fail(where, `물질명 답·서류 남은 일이 이상함: ${JSON.stringify(ren2)}`);
    console.log(`  수치 표기 시험표 ${nums.length ? "실패" : "통과"} · 청구항 ${claims.length ? "실패" : "통과"}`);
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
    // 화면이 권하는 예시 문장: 낱말을 틀의 자리(원료·방식·효과)에 맞춰 첫 명칭 후보가 말이 되고, 같은 낱말이 두 번 나오지 않는다
    const exs = await p.evaluate(() => PITCH_EX.map((x) => { const P = analyzePitch(x), D = ruleDrafts(P.field, kwList(pitchRoles(P, x).join(", ")), P), w = D.titles[0].split(/\s+/).map((s) => s.replace(/(을|를|이|가|의|용)$/, ""));
      return { t: D.titles[0], e: D.effects[0], dup: new Set(w).size < w.length }; }));
    const exWant = ["비행 기능을 갖춘 농업용 트랙터", "쌀겨 발효물을 포함하는 생장 촉진용 조성물", "양파 추출물을 유효성분으로 포함하는 혈당 조절용 조성물", "선도 유지를 위한 딸기 통기 포장 용기"];
    const exBad = exs.filter((r, k) => r.dup || r.t !== exWant[k] || /용기 기간|^액상|껍질 개선/.test(r.e));
    if (exBad.length) fail(where, `예시 문장의 명칭·효과 후보가 이상함: ${JSON.stringify(exBad)}`);
    await p.locator("#idea-pitch").fill("곡물로 만든 저염 간편식을 만들고 싶어요");
    await p.locator('[data-chat-ok="idea"]').click();
    const guessed = await p.evaluate(() => [S.idea.field, S.ideate.kw]);
    if (guessed[0] !== "food" || !/곡물/.test(guessed[1])) fail(where, `문장으로 정한 분야·낱말이 이상함: ${guessed}`);
    await p.locator("#ideate-run").click();
    // 답하기 전에 ‘다음’을 누르면 토스트가 질문을 알려 준다: 남은 일·토스트·제목·AIS로 보내는 상태에 프로그램 코드가 보이지 않는다
    await p.locator("#pagebar [data-nav=next]").click();
    const code = await p.evaluate(() => [document.querySelector("#main")?.innerText, document.querySelector(".board-next")?.textContent, document.querySelector("#toast")?.textContent, JSON.stringify(embedState()), ...[...document.querySelectorAll("[title]")].map((e) => e.title)].filter((t) => /=>|\$\{/.test(t || "")));
    if (code.length) fail(where, `화면에 프로그램 코드가 보임: ${code[0].slice(0, 120)}`);
    await pick("pick-problem", "1");
    await p.locator('[data-chat-ok="problem"]').click();
    await pick("data", "yes");
    // 판매 ‘있음’은 처음 판매한 날을 묻고, 그 날이 공지예외주장 기한(진단·출원서)에 들어간다
    await pick("sold", "yes");
    await p.locator("#soldDate").fill(await p.evaluate(() => iso(addMonths(today, -2))));
    await pick("disclosed", "no");
    await p.locator('[data-chat-ok="hist"]').click();
    const left = await p.evaluate(() => chatCur()?.id ?? "");
    if (left) fail(where, `질문이 남음: ${left}`);
    // 진단 화면(신규성 카드·기한 알림)에 ‘판매도 공개’를 한 번만 쓴다
    const sold = await p.evaluate(() => ({ date: S.idea.soldDate, light: diagnose().lights.find((l) => l.k === "신규성")?.c, form: /☒ 공지예외적용[\s\S]*【공개형태】 판매/.test(buildApplicationForm()), dday: !!embedState().dday,
      once: [...requirementCards().cards.filter((c) => c.k === "신규성").flatMap((c) => c.v), ...diagnose().alerts.map((a) => a.b)].join(" ").split("판매도 공개").length === 2 }));
    if (!sold.date || sold.light === "ok" || !sold.form || !sold.dday || !sold.once) fail(where, `판매 이력이 진단·출원서·기한에 들어가지 않음: ${JSON.stringify(sold)}`);
    const bubbles = await p.locator(".chat-a").count();
    if (bubbles < 5) fail(where, `답 말풍선이 ${bubbles}개뿐`);
    if ((await p.locator(".chat-nav .done").count()) < 5) fail(where, "질문 진행 칩이 답한 질문을 보여 주지 않음");
    // 다음에 누를 곳 안내: 질문을 다 답하면 아래 막대의 ‘다음’을 가리킨다
    await p.waitForFunction(() => !document.querySelector("#nh-tip").hidden && NH.el?.matches?.('#pagebar [data-nav="next"]'), null, { timeout: 3000 }).catch(() => {});
    const hint = await p.evaluate(() => ({ shown: !document.querySelector("#nh-tip").hidden, next: !!NH.el?.matches?.('#pagebar [data-nav="next"]') }));
    if (!hint.shown || !hint.next) fail(where, `다음 누를 곳 안내가 ‘다음’ 버튼을 가리키지 않음: ${JSON.stringify(hint)}`);
    // 현황판 ‘다음 할 일’도 지금 단계에 남은 일이 없으면 아래 막대의 ‘다음’과 같은 곳을 가리킨다 (다른 단계로 건너뛰게 하지 않는다)
    const nexts = await p.evaluate(() => ({ board: [...document.querySelectorAll(".board-next button")].map((b) => `${b.dataset.boardGo}:${b.textContent.replace(/\s*→$/, "").trim()}`), bar: document.querySelector("#pagebar [data-nav=next]")?.textContent.trim() }));
    if (!nexts.board.length || nexts.board.some((b) => b !== `next:${nexts.bar}`)) fail(where, `현황판 ‘다음 할 일’이 아래 ‘다음’과 다름: ${JSON.stringify(nexts)}`);
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
