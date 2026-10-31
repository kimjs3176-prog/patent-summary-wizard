// 출원용 명세서 작성 — Claude API(공식 SDK)로 특허법 시행규칙 서식 구조의 명세서 초안을 작성한다.
// 서버 키는 환경변수 ANTHROPIC_API_KEY 에서만 읽는다. 사용자가 화면에 넣은 키로 쓸 때는 브라우저가 draftPrompt 의 지침으로 직접 요청한다.
import Anthropic from "@anthropic-ai/sdk";

export const DRAFT_MODEL = process.env.DRAFT_MODEL || "claude-opus-5-5";
// 명세서는 길고 서식이 정해져 있어 기본은 medium (시간과 품질 사이). DRAFT_EFFORT 로 바꿀 수 있다
const EFFORT = ["low", "medium", "high", "xhigh", "max"].includes(process.env.DRAFT_EFFORT) ? process.env.DRAFT_EFFORT : "medium";
const MAX_TOKENS = 32000;
export const REVIEW_MARK = "<<<검토메모>>>";

export const SYSTEM_PROMPT = `당신은 농식품·생명공학 분야 특허 명세서를 작성하는 한국 변리사 수준의 전문가입니다.
출원인이 제공한 발명 정보로, 대한민국 지식재산처에 낼 특허 명세서·청구범위·요약서의 초안을 작성합니다. 초안은 출원인이 빈칸을 채우고 변리사 검토를 거쳐 다듬는다는 전제로 씁니다.

[서식]
특허법 시행규칙 제21조와 별지 제15호서식(명세서)·제16호서식(요약서)에 따라 아래 식별항목을 이 순서대로 씁니다. 식별항목 이름은 한 글자도 바꾸지 않습니다.
【발명의 설명】
【발명의 명칭】 국문 명칭{영문 명칭}   ← 한 줄에 적고, 국문 명칭은 제공된 발명의 명칭과 똑같이 씁니다.
【기술분야】
【발명의 배경이 되는 기술】
【선행기술문헌】 / 【특허문헌】   ← 제공된 문헌이 있을 때만. 문단 안에 "(특허문헌 1) KR 10-2020-0012345 A 2020. 2. 3."처럼 제공된 인용 표기를 그대로 씁니다(WIPO ST.14).
【발명의 내용】
【해결하려는 과제】
【과제의 해결 수단】
【발명의 효과】
【도면의 간단한 설명】   ← 도면이 있을 때만. 각 도면을 【도 1】, 【도 2】로 줄을 바꿔 적습니다.
【발명을 실시하기 위한 구체적인 내용】
【실시예 1】   ← 실시예는 이 식별항목으로 구분합니다. 비교예·실험예는 식별항목을 새로 만들지 말고 문단 첫머리에 "<비교예 1>", "<실험예 1>"처럼 소제목을 씁니다.
【산업상 이용가능성】
【부호의 설명】   ← 도면 부호가 있을 때만.
【수탁번호】   ← 미생물을 기탁했을 때 기탁기관과 수탁번호를 모아 적습니다.
【청구범위】
【청구항 1】 …
【요약서】
【요약】   ← 기술분야, 해결하려는 과제, 과제의 해결 수단, 효과를 400자 이내로.
【대표도】   ← 도면이 있을 때만 "도 1"처럼 적고, 도면이 없으면 이 항목을 쓰지 않습니다.
- 【기술분야】부터 【수탁번호】까지 각 문단 앞에 【0001】부터 이어지는 네 자리 식별번호를 붙입니다.
- 표는 【표 1】 다음 줄부터 칸을 " | "로 구분한 행으로 씁니다.
- 단위는 SI 단위로, 온도는 ℃로 씁니다. 이해하기 어려운 용어는 ( ) 안에 원어를 병기합니다.

[작성 원칙]
1. 사실만 씁니다. 제공되지 않은 실험 수치, 시험 결과, 시험 조건·방법, 반복 수·통계, 균주 기탁번호, 출원인 정보, 문헌 번호를 지어내지 않습니다. 필요한데 없는 정보는 〔입력 필요: 무엇을, 왜〕 형식으로 그 자리에 표시합니다.
   - 제공된 정보 중 "(예: …)"로 적힌 값은 화면이 보여 준 예시일 뿐 확인한 값이 아닙니다. 사실로 쓰지 말고 〔입력 필요: 확인한 값 (예시: …)〕로 표시합니다.
   - "보완 후보"는 근거 데이터가 없으므로 청구항과 발명의 설명에 넣지 않고 검토메모에만 적습니다.
2. 선행기술문헌은 제공된 목록에 있는 문헌만, 제공된 인용 표기 그대로 인용합니다.
3. 청구범위
   - 독립항은 발명의 핵심 구성만으로 넓게 쓰되, 선행문헌과 구별되는 구성을 반드시 포함합니다.
   - 종속항은 "청구항 N에 있어서,"로 시작해 수치 범위, 균주, 공정 조건, 용도를 단계적으로 한정합니다.
   - 2 이상의 항을 인용하는 청구항은 택일적으로 인용하고("청구항 1 내지 청구항 3 중 어느 한 항에 있어서"), 다른 다중 인용항을 직접 또는 간접으로 다시 인용하지 않습니다(특허법 시행령 제5조).
   - 물건 청구항과 별도로, 근거가 있으면 제조방법·사용방법 독립항을 둡니다. 발명의 명칭 전체를 한 청구항 끝에 붙이지 말고, 물건과 방법은 서로 다른 청구항으로 씁니다. 공정 단계·조건은 조성물의 구성으로 넣지 말고 방법 청구항에 씁니다.
   - 장치 청구항은 구성요소를 나열만 하지 말고, 구성 사이의 연결·결합 관계와 각 구성이 하는 동작을 적습니다. 도면이 없으면 도면 부호를 붙이지 않습니다.
   - 조성물의 함량 범위는 "조성물 총 중량에 대하여 5 내지 20 중량%"처럼 기준을 밝힙니다.
   - "약", "적정량", "유효량", "다량", "등" 같은 불명확한 표현을 청구항에 쓰지 않습니다. 수치 범위에는 단위를 씁니다.
   - 사람을 치료·진단하는 방법은 청구하지 않습니다(조성물, 식품, 용도로 청구).
   - 모든 청구항은 발명의 설명에 의해 뒷받침되어야 합니다. 청구항의 수치 범위와 구성은 실시예 등 제공된 근거로 실질적으로 뒷받침되어야 하며, 근거 없이 문구만 발명의 설명에 옮겨 적어서는 안 됩니다. 근거가 없는 한정은 청구항으로 만들지 말고 검토메모에 적습니다.
4. 발명의 설명은 통상의 기술자가 반복 재현할 수 있도록 재료, 조건, 순서, 측정 방법을 구체적으로 씁니다. 실시예와 비교예를 구분하고, 제공된 결과 수치만 사용합니다.
5. 공지예외주장 대상이면 발명의 설명에 쓰지 말고 검토메모에 남깁니다(출원서에서 주장하는 사항).
5-1. 미생물을 적을 때는 학명과 수탁번호를 함께 적습니다. 기탁하지 않은 시판·공지 균주는 수탁번호 대신 입수 방법(분양 기관·번호)을 적습니다. 염기·아미노산 서열은 서열번호를 붙이고 서열목록을 따로 낸다고 검토메모에 적습니다.
6. 문체는 한국 특허 명세서 문체("~이다", "~할 수 있다", "상기 ~")를 씁니다. 마크다운 기호(#, *, **)를 쓰지 않습니다.
7. 요약은 400자 이내로 씁니다.

[출력]
명세서 전문을 쓴 뒤, 마지막에 한 줄로 ${REVIEW_MARK} 를 쓰고 그 아래에 출원 전에 출원인·변리사가 확인할 사항을 "- "로 시작하는 줄로 나열합니다(〔입력 필요〕 항목의 요약, 거절 위험, 추가 실험 제안, 공지예외주장 여부 등).`;

const str = (v, max = 4000) => String(v ?? "").slice(0, max);

export function validateDraftInput(body) {
  const b = body ?? {};
  const title = str(b.title, 200).trim();
  if (!title) throw Object.assign(new Error("발명의 명칭을 입력하세요."), { status: 400 });
  const prior = (Array.isArray(b.prior) ? b.prior : []).slice(0, 8).map(p => ({
    applicationNumber: str(p?.applicationNumber, 20).replace(/[^0-9]/g, ""),
    title: str(p?.title, 300),
    abstract: str(p?.abstract, 1200),
    cite: str(p?.cite, 100)
  })).filter(p => p.applicationNumber && p.title);
  return {
    title,
    fieldName: str(b.fieldName, 60),
    claimType: str(b.claimType, 30),
    problem: str(b.problem),
    diff: str(b.diff),
    parts: str(b.parts),
    effect: str(b.effect, 2000),
    hasData: b.hasData === true,
    strainDeposited: b.strainDeposited === true,
    strain: ["yes", "no", "known"].includes(b.strain) ? b.strain : (b.strainDeposited === true ? "yes" : ""),
    strainName: str(b.strainName, 120),
    disclosure: b.disclosure ? { date: str(b.disclosure.date, 20), where: str(b.disclosure.where, 200) } : null,
    // 공백 분석의 보완 후보 (근거 데이터 없음). 예전 클라이언트의 uses·limits 도 받는다
    candidates: [
      ...(Array.isArray(b.candidates) ? b.candidates : []).map(c => str(typeof c === "string" ? c : [c?.use, c?.part].filter(Boolean).join(": "), 300)),
      ...(Array.isArray(b.uses) ? b.uses : []).map(u => str(u, 100)),
      ...(Array.isArray(b.limits) ? b.limits : []).map(u => str(u, 300))
    ].filter(Boolean).slice(0, 8),
    risks: (Array.isArray(b.risks) ? b.risks : []).slice(0, 10).map(r => str(r, 300)),
    engTitle: str(b.engTitle, 300),
    hasDrawings: b.hasDrawings === true,
    deposit: b.deposit ? { org: str(b.deposit.org, 120), no: str(b.deposit.no, 60) } : null,
    prior
  };
}

export function buildUserPrompt(d) {
  const lines = [
    `다음 발명으로 출원용 명세서를 작성해 주세요.`,
    ``,
    `<발명정보>`,
    `발명의 명칭(출원서와 같게 사용): ${d.title}`,
    `발명의 영문 명칭: ${d.engTitle || "〔미입력 — 〔입력 필요: 영문 명칭〕으로 표시〕"}`,
    `도면: ${d.hasDrawings ? "있음(도면 설명과 대표도 작성)" : "없음(【도면의 간단한 설명】·【부호의 설명】·【대표도】를 쓰지 않음)"}`,
    `기술 분야: ${d.fieldName || "미지정"}`,
    `주 청구 유형: ${d.claimType || "조성물"}`,
    `해결하려는 문제: ${d.problem || "〔미입력〕"}`,
    `기존 기술과 다른 점(조건·결과 포함): ${d.diff || "〔미입력〕"}`,
    `핵심 구성(한 줄에 하나, 수치 범위 포함):`,
    ...(d.parts ? d.parts.split("\n").filter(Boolean).map(p => `  - ${p.trim()}`) : ["  〔미입력〕"]),
    `효과: ${d.effect || "〔미입력〕"}`,
    `실험 데이터: ${d.hasData ? "있음 — 효과에 숫자로 적힌 값만 측정값으로 쓰고, \"(예: …)\" 값은 예시로 다룸" : "없음 또는 미확인 — 효과는 기대 효과로만 쓰고 결과 수치는 〔입력 필요〕로 둠"}`,
    `미생물: ${{ yes: `새 균주, 기탁 완료${d.deposit?.no ? ` (${d.deposit.org} ${d.deposit.no})` : " (수탁번호는 〔입력 필요〕로 표시)"}`, no: "새 균주, 아직 기탁 전 (출원 전에 기탁해야 하므로 수탁번호 자리를 〔입력 필요〕로 두고 검토메모에 경고)", known: "시판·공지 균주 (기탁하지 않음 — 입수 방법을 〔입력 필요〕로 둠)" }[d.strain] ?? (d.deposit?.no ? `${d.deposit.org} ${d.deposit.no}` : "해당 없음")}${d.strainName ? ` · 학명 ${d.strainName}` : ""}`,
    `보완 후보(공백 분석에서 고름, 근거 데이터 없음 — 청구항에 넣지 말고 검토메모에만): ${d.candidates.length ? d.candidates.join(" / ") : "없음"}`,
    `외부 공개 이력: ${d.disclosure ? `${d.disclosure.date} ${d.disclosure.where} (공지예외주장 대상)` : "없음"}`,
    `</발명정보>`
  ];
  if (d.prior.length) {
    lines.push(``, `<선행문헌 KIPRIS 검색 결과 — 이 목록 밖의 문헌은 인용하지 마세요>`);
    d.prior.forEach((p, i) => lines.push(`${i + 1}. 인용 표기 ${p.cite || `출원번호 ${p.applicationNumber}`} | ${p.title}${p.abstract ? ` | 요약: ${p.abstract}` : ""}`));
    lines.push(`</선행문헌>`);
  }
  if (d.risks.length) {
    lines.push(``, `<거절 위험 분석 — 청구항과 실시예 작성에 반영>`, ...d.risks.map(r => `- ${r}`), `</거절 위험 분석>`);
  }
  return lines.join("\n");
}

// 사용자 키로 브라우저에서 바로 작성할 때 쓰는 요청 내용. 서버 AI와 같은 지침·모델·설정이며, 서버 키 없이도 돌려준다
export function draftPrompt(input) {
  return { system: SYSTEM_PROMPT, user: buildUserPrompt(input), reviewMark: REVIEW_MARK, model: DRAFT_MODEL, effort: EFFORT, maxTokens: MAX_TOKENS };
}

export function splitReview(text) {
  const i = text.indexOf(REVIEW_MARK);
  const spec = (i < 0 ? text : text.slice(0, i)).replace(/\*\*/g, "").trim();
  const review = i < 0 ? [] : text.slice(i + REVIEW_MARK.length).split("\n").map(l => l.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
  return { spec, review };
}

let client;
const getClient = () => (client ??= new Anthropic());
export const draftEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function draftSpec(input, { anthropic = getClient() } = {}) {
  const stream = anthropic.beta.messages.stream({
    model: DRAFT_MODEL,
    max_tokens: MAX_TOKENS,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }]
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    throw Object.assign(new Error("명세서 작성 요청이 거절되었습니다. 발명 정보를 확인한 뒤 다시 시도하세요."), { status: 422 });
  }
  const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  if (!text.trim()) throw Object.assign(new Error("명세서가 생성되지 않았습니다. 다시 시도하세요."), { status: 502 });
  return { ...splitReview(text), truncated: msg.stop_reason === "max_tokens", model: msg.model };
}

// SDK 오류를 사용자에게 보여줄 HTTP 응답으로 바꾼다
export function draftErrorResponse(e) {
  if (e instanceof Anthropic.RateLimitError) return [429, "AI 사용량이 많습니다. 잠시 뒤 다시 시도하세요."];
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return [503, "서버의 ANTHROPIC_API_KEY 를 확인하세요."];
  if (e instanceof Anthropic.BadRequestError) return [502, `AI 요청 형식 오류: ${e.message}`];
  if (e instanceof Anthropic.APIConnectionError) return [502, "AI 서버에 연결하지 못했습니다."];
  if (e instanceof Anthropic.APIError) return [502, `AI 서버 오류 (${e.status ?? "?"})`];
  if (e.status) return [e.status, e.message];
  return null;
}
