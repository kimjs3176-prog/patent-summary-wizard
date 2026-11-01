// 출원지원 AI 분석 — 아이디어 초안(ideate), 유망기술 아이디어(discover), 유사 특허 심층 비교(compare), 공백기술 아이디어(whitespace),
// 거절이유 예상(reject), 명세서 검토(review), 〔입력 필요〕 칸 채우기(fill), 검토 메모·누락 항목 보완(supplement), 해외 사업화 전략(globalbiz), 키워드 사업 인사이트(insight).
// 서버에서는 Lovable AI 게이트웨이(gateway.js, JSON 출력)로 실행하고, 사용자가 화면에 키를 넣으면 같은 요청 내용(aiPrompt)으로 브라우저가 직접 실행한다.
import { DRAFT_MODEL } from "./draft.js";
import { chat } from "./gateway.js";

// 짧은 JSON 작업이라 기본은 low (빠르게). 더 깊게 보려면 AI_EFFORT 로 올린다
const EFFORT = ["low", "medium", "high", "xhigh", "max"].includes(process.env.AI_EFFORT) ? process.env.AI_EFFORT : "low";
const MAX_TOKENS = 16000;

const SYSTEM = `당신은 농식품 분야 특허 전략가입니다. 한국에서 특허 출원을 준비하는 농업인·연구자·중소기업을 돕습니다.

[원칙]
1. 제공된 데이터(출원 건수, 증가율, 선행문헌의 명칭·요약)만 근거로 씁니다. 없는 수치, 문헌번호, 실험 결과, 기관명을 지어내지 않습니다. 모르면 "확인 필요"라고 씁니다.
2. 특허 가능성을 단정하지 않습니다. 판단 근거와 출원 전에 확인할 점을 함께 적습니다.
3. 처음 특허를 준비하는 사람도 이해하도록 쉬운 한국어로 짧게 씁니다. 전문용어는 풀어 씁니다.
4. 아이디어와 구성은 실제로 실험하고 만들 수 있는 수준으로 구체적으로 씁니다. 확인하지 않은 수치·물질은 예시이므로 "(예: …)"처럼 괄호 안에 씁니다. 앱은 괄호 안 예시를 청구항에 넣지 않고 〔입력 필요〕로 남깁니다.
5. 지정된 JSON 형식으로만 답합니다.`;

const str = (v, max = 600) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null);
const arr = (v, max) => (Array.isArray(v) ? v : []).slice(0, max);
const bad = msg => Object.assign(new Error(msg), { status: 400 });
const obj = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const S = { type: "string" }, SA = { type: "array", items: { type: "string" } };

export const AI_TASKS = {
  // 키워드 몇 개로 발명의 명칭·해결할 문제·차별성·핵심 구성·효과 후보를 만든다 (사용자는 고르고 다듬기만 한다)
  ideate: {
    validate(b) {
      const keywords = arr(b?.keywords, 6).map(k => str(k, 40)).filter(Boolean);
      if (!keywords.length) throw bad("키워드를 하나 이상 입력하세요.");
      return { field: str(b?.field, 60), keywords, context: str(b?.context, 600) };
    },
    user: d => [
      `[기술 분야] ${d.field}`, `[키워드] ${d.keywords.join(", ")}`, d.context ? `[참고] ${d.context}` : "",
      "",
      "이 키워드로 한국에 특허 출원할 만한 발명 아이디어의 초안 후보를 만드세요. 사용자는 후보 중에서 고르고 다듬기만 합니다.",
      "- 발명의 명칭 3개: 특허 명칭 형식(예: ~을 포함하는 ~용 조성물, ~의 제조방법, ~ 장치).",
      "- 해결할 문제 3개: 현장에서 실제로 겪는 문제를 1~2문장으로. 서로 다른 관점(비용, 품질, 환경 등)으로.",
      "- 기존과 다른 점(차별성) 3개: 구성·조건·방법이 어떻게 다른지 구체적으로. 수치는 예시일 때 '(예: …)' 괄호로 씁니다.",
      "- 핵심 구성 4~6개: 물건·장치 청구항 구성요소로 쓸 수 있는 짧은 명사구(수치 범위 예시 포함 가능).",
      "- 방법 단계 4~5개: 명칭이 방법일 때 청구항에 쓸 단계. '~하는 단계' 형태로, 조건 예시는 '(예: …)' 괄호로 씁니다.",
      "- 기대 효과 3~4개: 측정할 수 있는 형태(예: 생체중, 저장 기간, 수율)로. 실험 결과처럼 단정하지 않습니다."
    ].filter(Boolean).join("\n"),
    schema: obj({ titles: SA, problems: SA, diffs: SA, parts: SA, steps: SA, effects: SA })
  },
  // 내 기술의 해외 사업화 전략: 시장별 진출 경로·규제 경로·파트너·첫 단계 (해외 출원은 다루지 않는다)
  globalbiz: {
    validate(b) {
      const title = str(b?.title, 200); if (!title) throw bad("발명의 명칭이 필요합니다.");
      return { title, field: str(b?.field, 60), problem: str(b?.problem, 600), diff: str(b?.diff, 800), parts: arr(b?.parts, 8).map(p => str(p, 120)).filter(Boolean),
        markets: arr(b?.markets, 6).map(m => str(m, 30)).filter(Boolean), goal: str(b?.goal, 40), trend: str(b?.trend, 400), sample: !!b?.sample, facts: arr(b?.facts, 6).map(f => str(f, 400)).filter(Boolean) };
    },
    user: d => [
      `[내 기술] ${d.title} (${d.field})`, `해결하는 문제: ${d.problem}`, `차별점: ${d.diff}`, d.parts.length ? `핵심 구성: ${d.parts.join(" / ")}` : "",
      `[관심 시장] ${d.markets.join(", ") || "추천해 주세요"}`, `[목표] ${d.goal || "해외 사업화"}`,
      d.trend ? `[해외 특허 동향] ${d.trend}${d.sample ? " (예시 데이터)" : ""}` : "",
      d.facts.length ? `[시장별 규제 정보 (공식 출처 기준, 2026. 10.)]\n${d.facts.map(f => `- ${f}`).join("\n")}` : "",
      "",
      "이 기술을 해외에서 사업화하는 전략을 짜 주세요. 해외 특허 출원 절차는 다루지 말고 시장·진출 경로·규제·파트너 중심으로 씁니다.",
      "- 시장 2~4곳: 왜 유망한지, 알맞은 진출 경로(수출 / 기술이전·라이선싱 / 현지 실증·파일럿 / 합작·현지 법인 중 하나), 거쳐야 할 규제·인증 경로(제도 이름까지, 확실하지 않으면 '확인 필요'), 찾을 파트너 유형, 첫 단계.",
      "- 주요 위험 3~5개와 사업화 전 확인할 일(체크리스트) 4~6개.",
      "규제는 위 [시장별 규제 정보]를 우선 쓰고, 거기 없는 기관명·제도명·기간을 지어내지 마세요. 확실하지 않으면 '확인 필요'라고 쓰세요."
    ].filter(Boolean).join("\n"),
    schema: obj({ summary: S,
      markets: { type: "array", items: obj({ market: S, why: S, route: { type: "string", enum: ["수출", "기술이전·라이선싱", "현지 실증·파일럿", "합작·현지 법인"] }, regulation: S, partner: S, firstStep: S }) },
      risks: SA, checklist: SA })
  },
  // 해외동향: 키워드 하나로 보는 농식품 사업 인사이트. 근거는 관세청 수출 실적·산업동향 기사·규제 정보·공식 통계이고, 그 밖은 일반 지식임을 밝힌다. 특허는 다루지 않는다
  insight: {
    validate(b) {
      const keyword = str(b?.keyword, 80); if (!keyword) throw bad("키워드를 입력하세요.");
      return { keyword, type: str(b?.type, 40), trade: arr(b?.trade, 12).map(x => str(x, 120)).filter(Boolean), tradeMeta: str(b?.tradeMeta, 200), news: arr(b?.news, 8).map(x => str(x, 300)).filter(Boolean),
        regs: arr(b?.regs, 8).map(x => str(x, 400)).filter(Boolean), stats: arr(b?.stats, 8).map(x => str(x, 200)).filter(Boolean), sample: !!b?.sample };
    },
    user: d => [
      `[키워드] ${d.keyword}${d.type ? ` (제품 유형: ${d.type})` : ""}`,
      d.trade.length ? `[한국 수출 실적 — 관세청, ${d.tradeMeta}${d.sample ? ", 예시 데이터" : ""}]\n${d.trade.map(x => `- ${x}`).join("\n")}` : "[한국 수출 실적 없음]",
      d.news.length ? `[최근 산업동향 기사${d.sample ? " (예시)" : ""}]\n${d.news.map(x => `- ${x}`).join("\n")}` : "",
      d.regs.length ? `[시장별 규제·인증 (공식 출처 기준, 2026. 10.)]\n${d.regs.map(x => `- ${x}`).join("\n")}` : "",
      d.stats.length ? `[공식 통계·시장 신호]\n${d.stats.map(x => `- ${x}`).join("\n")}` : "",
      "",
      "이 키워드 제품·기술을 해외 사업 관점에서 읽는 인사이트를 쓰세요. 농식품 기업 담당자가 10분 안에 읽고 어느 시장을 먼저, 무엇부터 할지 정할 수 있게 짧고 구체적으로. 특허·출원 이야기는 쓰지 않습니다.",
      "- summary: 이 제품·기술의 해외 시장이 지금 어디쯤 와 있는지 두 문장, 120자 안쪽.",
      "- demand: 수요·소비 흐름 3~5개, 각 60자 안쪽 한 문장 (소비자 관심, 유통 형태, 가격대, 대체·경쟁 품목). 문장 끝에 근거를 괄호로: '(기사 1)', '(수출 실적)', '(공식 통계)', 없으면 '(일반적으로 알려진 흐름)'.",
      "- exportRead: 위 수출 실적을 읽어 주는 문장 3~4개, 각 60자 안쪽 (어느 나라가 크고, 어디가 빠르게 늘고, 어디가 빠져 있는지). 끝에 '(수출 실적)'. 실적이 없으면 빈 배열.",
      "- markets: 미국·EU·중국·일본·동남아·중동 가운데 4~6곳을 region·d로. region은 그 이름 그대로, d는 80자 안쪽 한두 문장(수요·규제·인증·유통 경로). 규제는 위 [시장별 규제·인증]만 쓰고 없으면 '확인 필요'.",
      "- players: 경쟁·참고 기업과 제품 4~8개. where는 '국내' 또는 '해외'. 확실한 기업만 적고 note에 무엇으로 알려졌는지 한 줄. 모르면 적지 않습니다.",
      "- opportunities: 기회 2~4개 (비어 있는 시장·형태·채널).",
      "- risks: 위험 2~4개 (규제·가격·물류·모방 등).",
      "- actions: 농산업체가 지금 할 일 3~5개, 순서대로, 각 50자 안쪽 (어느 시장을 먼저, 어떤 경로로, 무엇을 준비, 어느 지원사업).",
      "지어내지 않습니다: 없는 수치·점유율·기관명·기업명을 만들지 말고, 확실하지 않으면 '확인 필요'라고 씁니다."
    ].filter(Boolean).join("\n"),
    schema: obj({ summary: S, demand: SA, exportRead: SA, markets: { type: "array", items: obj({ region: S, d: S }) },
      players: { type: "array", items: obj({ name: S, where: { type: "string", enum: ["국내", "해외"] }, note: S }) }, opportunities: SA, risks: SA, actions: SA })
  },
  // 유망기술(성장 빠르고 국내 출원이 적은 세부기술)에서 출원할 만한 아이디어 후보를 만든다
  discover: {
    validate(b) {
      const themes = arr(b?.themes, 4).map(t => ({ name: str(t?.name, 60), growth: num(t?.growth), krShare: num(t?.krShare), avgKr: num(t?.avgKr), krRecent: num(t?.krRecent), krChange: num(t?.krChange) })).filter(t => t.name);
      if (!themes.length) throw bad("유망기술을 하나 이상 고르세요.");
      return { field: str(b?.field, 60), themes, keywords: arr(b?.keywords, 8).map(k => str(k, 40)).filter(Boolean), resources: str(b?.resources, 600), goal: str(b?.goal, 40), sample: !!b?.sample };
    },
    user: d => [
      `[관심 분야] ${d.field}`,
      `[유망기술 후보]`, ...d.themes.map(t => `- ${t.name}: 세계 출원 연 ${t.growth ?? "?"}% 증가, 한국 비중 ${t.krShare ?? "?"}% (분야 평균 ${t.avgKr ?? "?"}%)${t.krRecent != null ? `, 국내 최근 5년 ${t.krRecent}건(KIPRIS 실데이터${t.krChange != null ? `, 이전 5년 대비 ${t.krChange > 0 ? "+" : ""}${t.krChange}%` : ""})` : ""}`),
      d.keywords.length ? `[최근 늘어나는 키워드] ${d.keywords.join(", ")}` : "",
      `[보유 자원·역량] ${d.resources || "입력 없음"}`,
      `[목표] ${d.goal || "국내 출원 후 사업화"}`,
      d.sample ? "※ 출원 건수와 증가율은 화면 구성용 예시 데이터입니다. 수치를 근거로 단정하지 마세요." : "",
      "",
      "위 유망기술 후보마다 보유 자원을 살려 한국에 특허 출원할 만한 발명 아이디어를 모두 합쳐 3~4개 제안하세요.",
      "각 아이디어는 발명의 명칭(특허 명칭 형식), 한 줄 요약, 해결하려는 문제, 해결 방법(핵심 구성과 작동 원리), 핵심 구성 2~4개, 유망한 이유(위 데이터 근거), 주 청구 유형, 처음 해 볼 실험, 주의할 점을 씁니다."
    ].filter(Boolean).join("\n"),
    schema: obj({ ideas: { type: "array", items: obj({
      title: S, summary: S, theme: S, problem: S, solution: S, parts: SA, why: S,
      claimType: { type: "string", enum: ["조성물", "제조방법", "장치·시스템", "용도·처리방법", "미생물·균주"] },
      firstExperiment: S, risk: S }) } })
  },
  // 내 아이디어와 가장 비슷한 특허들을 구성 단위로 비교하고 차별화 방향을 제안한다
  compare: {
    validate(b) {
      const idea = { title: str(b?.idea?.title, 200), problem: str(b?.idea?.problem, 800), diff: str(b?.idea?.diff, 1200), parts: arr(b?.idea?.parts, 8).map(p => str(p, 120)).filter(Boolean) };
      if (!idea.title) throw bad("발명의 명칭이 필요합니다.");
      const patents = arr(b?.patents, 5).map(p => ({ no: str(p?.no, 20), title: str(p?.title, 200), abstract: str(p?.abstract, 900), status: str(p?.status, 20), applicant: str(p?.applicant, 60), sim: num(p?.sim) })).filter(p => p.title);
      if (!patents.length) throw bad("비교할 유사 특허가 없습니다. 먼저 KIPRIS 탐색을 하세요.");
      return { idea, patents, sample: !!b?.sample };
    },
    user: d => [
      `[내 아이디어] ${d.idea.title}`, `해결하려는 문제: ${d.idea.problem}`, `기존과 다른 점: ${d.idea.diff}`,
      d.idea.parts.length ? `핵심 구성: ${d.idea.parts.join(" / ")}` : "",
      "", "[유사 특허]",
      ...d.patents.map((p, i) => `${i + 1}. ${p.title} (${p.no || "번호 없음"}, ${p.status || "상태 미상"}, ${p.applicant || "출원인 미상"}, 글자 유사도 ${p.sim ?? "?"}%)\n   요약: ${p.abstract || "요약 없음"}`),
      d.sample ? "※ 유사 특허는 모의 데이터입니다." : "",
      "",
      "각 유사 특허와 내 아이디어의 공통점·차이점을 구성 단위로 비교하고, 신규성·진보성 위험(상/중/하)과 그 이유, 차별화 조언을 쓰세요.",
      "마지막으로 전체 요약, 내 아이디어만의 차별점 후보, 피해야 할(겹치는) 구성, 차별점을 뒷받침할 비교 실험을 쓰세요. 요약에 없는 내용은 추측하지 말고 '요약만으로는 확인 어려움'이라고 쓰세요."
    ].filter(Boolean).join("\n"),
    schema: obj({
      summary: S,
      patents: { type: "array", items: obj({ no: S, title: S, common: SA, different: SA, risk: { type: "string", enum: ["상", "중", "하"] }, riskReason: S, advice: S }) },
      differentiators: SA, avoid: SA, experiments: SA })
  },
  // 공백 맵에서 고른 빈 칸(기술 요소 × 효과·용도)을 구체적인 발명 구성으로 바꾼다
  whitespace: {
    validate(b) {
      const cells = arr(b?.cells, 4).map(c => ({ row: str(c?.row, 60), col: str(c?.col, 60), count: num(c?.count), rowTotal: num(c?.rowTotal), colTotal: num(c?.colTotal) })).filter(c => c.row && c.col);
      if (!cells.length) throw bad("공백 맵에서 칸을 하나 이상 고르세요.");
      return { field: str(b?.field, 60), title: str(b?.title, 200), parts: arr(b?.parts, 8).map(p => str(p, 120)).filter(Boolean), cells, sample: !!b?.sample };
    },
    user: d => [
      `[분야] ${d.field}`, `[지금 아이디어] ${d.title}`, d.parts.length ? `핵심 구성: ${d.parts.join(" / ")}` : "",
      "", "[고른 공백 칸] (기존 출원 건수, 같은 기술 요소 전체 건수, 같은 효과·용도 전체 건수)",
      ...d.cells.map(c => `- ${c.row} × ${c.col}: ${c.count ?? "?"}건 (기술 요소 ${c.rowTotal ?? "?"}건, 효과·용도 ${c.colTotal ?? "?"}건)`),
      d.sample ? "※ 건수는 예시 데이터입니다." : "",
      "",
      "칸마다 지금 아이디어를 그 방향으로 넓히는 구체적인 발명 구성을 제안하세요: 확장 방향(짧은 이름), 명세서·청구항에 넣을 구성 문장(수치 범위 포함, 예시는 '(예: …)' 괄호로), 효과를 보여 줄 실험, 이 칸이 비어 있는 이유와 유망한 이유(추정이면 추정이라고)."
    ].filter(Boolean).join("\n"),
    schema: obj({ cells: { type: "array", items: obj({ row: S, col: S, use: S, part: S, exp: S, why: S }) } })
  }
};

// 거절이유 예상: 아이디어·사실 답변·유사 특허·같은 키워드 거절 출원의 심사 이력으로 심사관이 낼 만한 거절이유와 대비책을 정리한다
const LAWS = ["신규성 (특허법 제29조 제1항)", "진보성 (제29조 제2항)", "확대된 선출원 (제29조 제3항)", "기재불비 (제42조 제4항)", "실시가능요건 (제42조 제3항 제1호)", "산업상 이용가능성 (제29조 제1항 본문)", "발명 성립성 (제2조 제1호)", "공지예외주장 (제30조)"];
const LEVEL = { type: "string", enum: ["상", "중", "하"] };
AI_TASKS.reject = {
  validate(b) {
    const i = b?.idea ?? {}, f = b?.facts ?? {};
    const idea = { title: str(i.title, 200), field: str(i.field, 60), kind: str(i.kind, 30), problem: str(i.problem, 800), diff: str(i.diff, 1200), effect: str(i.effect, 400), parts: arr(i.parts, 8).map(p => str(p, 160)).filter(Boolean) };
    if (!idea.title) throw bad("발명의 명칭이 필요합니다.");
    const facts = { disclosed: str(f.disclosed, 10), discDate: str(f.discDate, 20), data: str(f.data, 10), sold: str(f.sold, 10), strain: str(f.strain, 10) };
    const patents = arr(b?.patents, 5).map(p => ({ no: str(p?.no, 20), title: str(p?.title, 200), abstract: str(p?.abstract, 700), status: str(p?.status, 20), sim: num(p?.sim) })).filter(p => p.title);
    const rejected = arr(b?.rejected, 6).map(r => ({ category: str(r?.category, 40), share: num(r?.share) })).filter(r => r.category);
    const cases = arr(b?.cases, 5).map(c => ({ title: str(c?.title, 200), category: str(c?.category, 40), notices: num(c?.notices) })).filter(c => c.title);
    return { idea, facts, patents, rejected, cases, rules: arr(b?.rules, 8).map(r => str(r, 200)).filter(Boolean), sample: !!b?.sample };
  },
  user: d => {
    const yn = v => ({ yes: "예", no: "아니요", known: "공지 균주", "": "답하지 않음" }[v] ?? v);
    return [
      `[내 아이디어] ${d.idea.title} (${d.idea.field}, ${d.idea.kind || "청구 유형 미정"} 발명)`, `해결하려는 문제: ${d.idea.problem}`, `기존과 다른 점: ${d.idea.diff}`,
      d.idea.parts.length ? `핵심 구성: ${d.idea.parts.join(" / ")}` : "", d.idea.effect ? `효과: ${d.idea.effect}` : "",
      `[사실] 외부 공개: ${yn(d.facts.disclosed)}${d.facts.discDate ? ` (${d.facts.discDate})` : ""} · 판매: ${yn(d.facts.sold)} · 실험 데이터: ${yn(d.facts.data)}${d.facts.strain ? ` · 새 균주 기탁: ${yn(d.facts.strain)}` : ""}`,
      d.patents.length ? ["", "[유사 특허]", ...d.patents.map((p, n) => `${n + 1}. ${p.title} (${p.no || "번호 없음"}, ${p.status || "상태 미상"}, 글자 유사도 ${p.sim ?? "?"}%)\n   요약: ${p.abstract || "요약 없음"}`)].join("\n") : "[유사 특허] 아직 조사하지 않음",
      d.rejected.length ? `[같은 키워드 거절 출원의 거절 유형 비율] ${d.rejected.map(r => `${r.category} ${r.share ?? "?"}%`).join(", ")}` : "",
      d.cases.length ? `[비슷한 거절 출원] ${d.cases.map(c => `${c.title} (${c.category}, 의견제출통지 ${c.notices ?? "?"}회)`).join(" / ")}` : "",
      d.rules.length ? `[앱의 규칙 점검] ${d.rules.join(" / ")}` : "",
      d.sample ? "※ 유사 특허·거절 통계는 예시 데이터입니다." : "",
      "",
      "심사관이 이 출원에 낼 만한 거절이유를 위험이 큰 것부터 3~6개 예상하세요. 각각 근거 조문, 위험(상/중/하), 왜 그렇게 보는지, 근거(위 유사 특허 번호나 사실 답변), 출원 전에 할 대비책을 씁니다.",
      "그다음 청구항을 짤 때 지킬 점 3~5개, 출원 전에 해 둘 실험 2~4개, 출원 전 확인할 일 2~4개를 씁니다. 위 데이터에 없는 문헌·수치를 지어내지 말고, 요약만으로 판단하기 어려우면 그렇게 쓰세요."
    ].filter(Boolean).join("\n");
  },
  schema: obj({ summary: S,
    reasons: { type: "array", items: obj({ law: { type: "string", enum: LAWS }, level: LEVEL, why: S, basis: S, fix: S }) },
    claimTips: SA, experiments: SA, beforeFiling: SA })
};
// 명세서 검토: 다 쓴 명세서를 심사관처럼 읽고 명확성·뒷받침·인용 관계 등 문제를 찾아, 바꿀 문장(원문 그대로)과 고친 문장을 함께 준다
const ISSUE_TYPES = ["명확성", "뒷받침", "인용 관계", "용어 일관성", "권리 범위", "실시예·효과", "형식", "입력 필요"];
AI_TASKS.review = {
  validate(b) {
    const spec = String(b?.spec ?? "").replace(/\r/g, "").slice(0, 16000).trim();
    if (spec.length < 200 || !/【청구항\s*1】/.test(spec)) throw bad("검토할 명세서가 없습니다. 청구항이 있는 명세서를 먼저 만드세요.");
    return { title: str(b?.title, 200), field: str(b?.field, 60), kind: str(b?.kind, 30), spec };
  },
  user: d => [
    `[발명] ${d.title} (${d.field}, ${d.kind || "청구 유형 미정"} 발명)`, "", "[명세서]", d.spec, "",
    "이 명세서를 특허청 심사관의 눈으로 검토하세요. 특히 청구범위를 먼저 봅니다.",
    "- 명확성: 청구항의 '적정량', '약', '바람직하게는', '등' 같은 모호한 말, 범위가 겹치거나 단위가 빠진 수치.",
    "- 뒷받침: 청구항 구성이 발명의 설명(실시예)에 적혀 있는지.",
    "- 인용 관계: 종속항이 없는 항이나 뒤의 항을 인용하는지, 다중 인용이 다시 다중 인용을 인용하는지.",
    "- 용어 일관성, 권리 범위(너무 좁거나 넓음), 실시예·효과의 근거, 형식(식별 항목·부호), 남은 〔입력 필요〕.",
    "문제를 중요한 것부터 4~10개 찾으세요. 고칠 문장이 있으면 before에 명세서에서 그대로 복사한 문장 조각(20~200자, 한 곳에만 나오는 것)을, after에 고친 문장을 씁니다. 바꿀 문장이 없거나 사용자가 사실을 채워야 하면 before·after는 빈 문자열로 둡니다.",
    "고친 문장에 확인하지 않은 수치나 실험 결과를 새로 넣지 말고, 필요하면 〔입력 필요〕로 남깁니다. 끝으로 전체 요약과 잘된 점 2~3개를 씁니다."
  ].join("\n"),
  schema: obj({ summary: S,
    issues: { type: "array", items: obj({ where: S, type: { type: "string", enum: ISSUE_TYPES }, severity: { type: "string", enum: ["높음", "보통", "낮음"] }, problem: S, before: S, after: S }) },
    strengths: SA })
};

// 〔입력 필요〕 칸 한꺼번에 채우기: 칸마다 앞뒤 문장과 아이디어·선행문헌을 주고, 그 칸에 들어갈 말만 받는다.
// 실험값·기탁 정보 같은 사실 칸은 앱이 보내지 않고, 보낸 칸에서도 확인하지 않은 수치는 〔입력 필요: …〕로 남기게 한다
const ctx = v => String(v ?? "").replace(/\s+/g, " "); // 빈칸 앞뒤 문장은 띄어쓰기를 살린다 (trim 하지 않음)
AI_TASKS.fill = {
  validate(b) {
    const i = b?.idea ?? {};
    const idea = { title: str(i.title, 200), field: str(i.field, 60), kind: str(i.kind, 30), problem: str(i.problem, 800), diff: str(i.diff, 1200), effect: str(i.effect, 400), parts: arr(i.parts, 8).map(p => str(p, 160)).filter(Boolean) };
    if (!idea.title) throw bad("발명의 명칭이 필요합니다.");
    const prior = arr(b?.prior, 5).map(p => ({ n: num(p?.n), title: str(p?.title, 200), abstract: str(p?.abstract, 700) })).filter(p => p.title);
    const slots = arr(b?.slots, 40).map(x => ({ id: str(x?.id, 8), label: str(x?.label, 160), section: str(x?.section, 40), before: ctx(x?.before).slice(-260), after: ctx(x?.after).slice(0, 160) })).filter(x => x.id && x.label);
    if (!slots.length) throw bad("채울 칸이 없습니다.");
    return { idea, prior, slots, engTitle: str(b?.engTitle, 200) };
  },
  user: d => [
    `[발명] ${d.idea.title} (${d.idea.field}, ${d.idea.kind || "청구 유형 미정"} 발명)`, `해결하려는 문제: ${d.idea.problem}`, `기존과 다른 점: ${d.idea.diff}`,
    d.idea.parts.length ? `핵심 구성: ${d.idea.parts.join(" / ")}` : "", d.idea.effect ? `효과: ${d.idea.effect}` : "",
    d.prior.length ? ["[명세서에 인용한 특허문헌]", ...d.prior.map(p => `특허문헌 ${p.n ?? "?"}: ${p.title}\n   요약: ${p.abstract || "요약 없음"}`)].join("\n") : "",
    "",
    "[채울 칸] 형식: #번호 [들어 있는 항목] …앞 문장《빈칸: 무엇을 쓸지》뒤 문장…",
    ...d.slots.map(x => `#${x.id} [${x.section || "?"}] …${x.before}《빈칸: ${x.label}》${x.after}…`),
    "",
    "특허 명세서의 빈칸을 채우세요. 칸마다 빈칸 자리에 들어갈 말만 씁니다(앞뒤 문장을 되풀이하지 않음). 앞뒤 문장과 이어 읽었을 때 자연스러운 명세서 문체(~이다, ~한다)로 씁니다.",
    "- 영문 명칭은 발명의 명칭을 영어 특허 명칭으로 옮겨 대문자로 씁니다.",
    "- 특허문헌과의 차이는 위 요약에 나온 내용만 근거로 쓰고, 요약으로 알 수 없으면 '요약만으로는 확인 어려움'처럼 쓰지 말고 그 칸은 빈 문자열로 둡니다.",
    "- 실험으로 잰 값, 온도·시간·함량 같은 실제 조건, 기탁 정보, 문헌에 없는 사실은 지어내지 않습니다. 문장 구조는 쓰되 그 값 자리는 〔입력 필요: 무엇〕으로 남깁니다.",
    "- 쓸 근거가 없거나 사용자만 알 수 있는 칸은 text를 빈 문자열로 둡니다.",
    "모든 칸에 대해 id와 text를 돌려주고, 끝으로 사용자가 꼭 확인할 점 2~4개를 notes에 씁니다."
  ].filter(Boolean).join("\n"),
  schema: obj({ fills: { type: "array", items: obj({ id: S, text: S }) }, notes: SA })
};

// 검토 메모·자주 빠뜨리는 것 보완: 항목마다 명세서에 이미 있는지 보고, 실험 설계·데이터 확보 뒤 넣을 청구항 초안·명세서에 넣을 문단 초안을 준다.
// 확인하지 않은 값은 〔입력 필요: …〕로 남기게 하고, 앱은 문단만 눌러서 넣을 수 있게 한다 (청구항은 데이터 확보 뒤 사용자가 직접)
export const SUP_WHERE = ["과제의 해결 수단", "발명의 효과", "발명을 실시하기 위한 구체적인 내용", "수탁번호", "산업상 이용가능성", "없음"];
AI_TASKS.supplement = {
  validate(b) {
    const i = b?.idea ?? {};
    const idea = { title: str(i.title, 200), field: str(i.field, 60), kind: str(i.kind, 30), diff: str(i.diff, 1200), effect: str(i.effect, 400), parts: arr(i.parts, 8).map(p => str(p, 160)).filter(Boolean), data: str(i.data, 10) };
    if (!idea.title) throw bad("발명의 명칭이 필요합니다.");
    const memos = arr(b?.memos, 10).map(m => str(m, 500)).filter(Boolean), checks = arr(b?.checks, 10).map(m => str(m, 200)).filter(Boolean);
    if (!memos.length && !checks.length) throw bad("보완할 항목이 없습니다.");
    return { idea, memos, checks, spec: String(b?.spec ?? "").replace(/\r/g, "").slice(0, 14000).trim() };
  },
  user: d => [
    `[발명] ${d.idea.title} (${d.idea.field}, ${d.idea.kind || "청구 유형 미정"} 발명)`, `기존과 다른 점: ${d.idea.diff}`,
    d.idea.parts.length ? `핵심 구성: ${d.idea.parts.join(" / ")}` : "", d.idea.effect ? `효과: ${d.idea.effect}` : "",
    `실험 데이터: ${{ yes: "있음", no: "없음" }[d.idea.data] ?? "답하지 않음"}`,
    d.memos.length ? ["", "[검토 메모]", ...d.memos.map((m, n) => `메모 ${n + 1}. ${m}`)].join("\n") : "",
    d.checks.length ? ["", "[이 분야에서 자주 빠뜨리는 것]", ...d.checks.map((m, n) => `확인 ${n + 1}. ${m}`)].join("\n") : "",
    "", "[지금 명세서]", d.spec || "(아직 없음)", "",
    "위 메모와 확인 항목마다 출원 전에 보완할 방법을 정리하세요. 항목마다:",
    "- kind는 '메모' 또는 '확인', n은 항목 번호(문자열).",
    "- status: 지금 명세서에 이미 충분히 적혀 있으면 '명세서에 있음', 명세서 문장으로 보완할 수 있으면 '보완 필요', 실험·기탁처럼 사용자가 사실을 마련해야 하면 '사실 확인 필요'.",
    "- how: 무엇을 하면 되는지 한두 문장.",
    "- experiment: 실험이 필요하면 처리구·대조구(비교예), 측정 지표와 방법, 반복 수, 기간을 구체적으로. 필요 없으면 빈 문자열.",
    "- claim: 데이터를 확보한 뒤 추가할 종속항이나 용도 청구항 초안(예: '제1항에 있어서, …'). 수치 자리는 〔입력 필요: …〕. 필요 없으면 빈 문자열.",
    "- text: 지금 명세서에 넣을 문단 초안(명세서 문체, 문단 번호 없이). 확인하지 않은 값·기관명·번호는 〔입력 필요: …〕로 남기고, 실험 결과를 지어내지 않습니다. 넣을 것이 없거나 이미 있으면 빈 문자열.",
    "- where: text를 넣을 항목. 정해진 값 중에서 고르고, text가 없으면 '없음'.",
    "끝으로 전체 요약 한두 문장을 씁니다."
  ].filter(Boolean).join("\n"),
  schema: obj({ summary: S,
    items: { type: "array", items: obj({ kind: { type: "string", enum: ["메모", "확인"] }, n: S, status: { type: "string", enum: ["명세서에 있음", "보완 필요", "사실 확인 필요"] }, how: S, experiment: S, claim: S, text: S, where: { type: "string", enum: SUP_WHERE } }) } })
};

// 사용자가 받아들이지 않았거나 되돌린 이전 제안(최근 8개). 같은 제안을 되풀이하지 않게 요청 끝에 붙인다
export const feedbackOf = b => {
  const f = arr(b?.feedback, 20).map(x => str(x, 200)).filter(Boolean).slice(0, 8);
  return f.length ? `\n\n[사용자가 받아들이지 않은 이전 제안]\n${f.map(x => `- ${x}`).join("\n")}\n같은 제안은 되풀이하지 말고, 꼭 필요하면 다른 방법을 제안하세요.` : "";
};

// 사용자 키로 브라우저에서 바로 실행할 때 쓰는 요청 내용. 서버 실행(runAi)과 같은 지침·형식(JSON 스키마)·모델·설정이다
export function aiPrompt(task, body) {
  const t = AI_TASKS[task]; if (!t) throw bad("알 수 없는 작업입니다.");
  const input = t.validate(body);
  return { task, system: SYSTEM, user: t.user(input) + feedbackOf(body), schema: t.schema, model: DRAFT_MODEL, effort: EFFORT, maxTokens: MAX_TOKENS };
}

// 게이트웨이는 JSON 객체로만 답하게 할 수 있고 스키마를 강제하지는 않으므로, 지켜야 할 형식(JSON 스키마)을 지침에 함께 적는다
export const schemaNote = schema => `\n\n[답 형식]\n아래 JSON 스키마를 그대로 따르는 JSON 객체 하나로만 답하세요. 설명 문장이나 코드 블록 표시(\`\`\`)를 붙이지 마세요.\n${JSON.stringify(schema)}`;

// 앞뒤에 코드 블록 표시나 군말이 붙어 와도 가장 바깥 { … } 를 읽는다
export function parseJsonObject(text) {
  const t = String(text ?? "").trim();
  try { return JSON.parse(t); } catch { /* 아래에서 다시 */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no json");
  return JSON.parse(t.slice(a, b + 1));
}

export async function runAi(task, body, { chatImpl = chat } = {}) {
  const t = AI_TASKS[task]; if (!t) throw bad("알 수 없는 작업입니다.");
  const input = t.validate(body);
  const msg = await chatImpl({ system: SYSTEM + schemaNote(t.schema), user: t.user(input) + feedbackOf(body), json: true, maxTokens: MAX_TOKENS });
  if (msg.finishReason === "content_filter") throw Object.assign(new Error("AI가 요청을 처리하지 않았습니다. 입력 내용을 확인한 뒤 다시 시도하세요."), { status: 422 });
  if (msg.finishReason === "length") throw Object.assign(new Error("AI 답변이 너무 길어 잘렸습니다. 다시 시도하세요."), { status: 502 });
  let result;
  try { result = parseJsonObject(msg.text); }
  catch { throw Object.assign(new Error("AI 답변을 읽지 못했습니다. 다시 시도하세요."), { status: 502 }); }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw Object.assign(new Error("AI 답변을 읽지 못했습니다. 다시 시도하세요."), { status: 502 });
  return { task, result, model: msg.model };
}
