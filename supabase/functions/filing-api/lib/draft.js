// 출원용 명세서 작성 — 특허법 시행규칙 서식 구조의 명세서 초안을 작성한다.
// 서버 AI 는 Lovable AI 게이트웨이(gateway.js, LOVABLE_API_KEY)로 부른다. 사용자가 화면에 넣은 키로 쓸 때는 브라우저가 draftPrompt 의 지침으로 직접 요청한다.
import { lintSpec } from "./specCheck.js";
import { chat, gatewayEnabled, gatewayErrorResponse } from "./gateway.js";

// 사용자가 화면에 Claude 키를 넣었을 때 브라우저가 부를 모델 (draftPrompt·aiPrompt 가 알려 준다). 서버 AI 모델은 gateway.js 의 SERVER_MODEL
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
- 【기술분야】부터 【수탁번호】까지 각 문단 앞에 【0001】부터 이어지는 네 자리 식별번호를 붙입니다. 【청구범위】와 【요약서】에는 식별번호를 붙이지 않습니다.
- 표는 【표 1】 다음 줄부터 칸을 " | "로 구분한 행으로 씁니다.
- 단위는 SI 단위로, 온도는 ℃로 씁니다. 이해하기 어려운 용어는 ( ) 안에 원어를 병기합니다.

[작성 원칙]
1. 사실만 씁니다. 제공되지 않은 실험 수치, 시험 결과, 시험 조건·방법, 반복 수·통계, 균주 기탁번호, 출원인 정보, 문헌 번호를 지어내지 않습니다. 필요한데 없는 정보는 〔입력 필요: 무엇을, 왜〕 형식으로 그 자리에 표시합니다.
   - 제공된 정보 중 "(예: …)"로 적힌 값은 화면이 보여 준 예시일 뿐 확인한 값이 아닙니다. 사실로 쓰지 말고 〔입력 필요: 확인한 값 (예시: …)〕로 표시합니다.
   - "보완 후보"는 근거 데이터가 없으므로 청구항과 발명의 설명에 넣지 않고 검토메모에만 적습니다.
   - 실험 데이터가 없으면 실시예·비교예·실험예의 조건과 결과, 표의 측정값을 추정해 채우지 말고 칸마다 〔입력 필요: 측정 항목과 결과〕로 둡니다. 확인되지 않은 효과는 "~할 수 있다"로 쓰고 "~하였다", "~이 확인되었다"처럼 결과로 쓰지 않습니다.
2. 선행기술문헌은 제공된 목록에 있는 문헌만, 제공된 인용 표기 그대로 인용합니다. 문헌의 내용은 제공된 명칭·요약에 있는 것만 쓰고, 요약에 없는 구성을 "개시하지 않는다"고 단정하지 말고 "요약에 기재되어 있지 않다"로 쓴 뒤 검토메모에 청구범위 전문 확인을 남깁니다.
3. 청구범위
   - 독립항은 발명의 핵심 구성만으로 넓게 쓰되, 선행문헌과 구별되는 구성을 반드시 포함합니다.
   - 종속항은 "청구항 N에 있어서,"로 시작해 수치 범위, 균주, 공정 조건, 용도를 단계적으로 한정하고, 인용하는 청구항과 같은 대상으로 끝냅니다(예: 청구항 1이 "…병해 억제용 조성물."이면 종속항도 "…인 것을 특징으로 하는 병해 억제용 조성물."). 범주가 다른 청구항(조성물의 제조방법 등)은 "…를 포함하는, 청구항 1의 조성물의 제조방법."처럼 독립항 형식으로 씁니다.
   - "상기 ○○"는 그 청구항이나 그 청구항이 인용하는 청구항에 앞서 나온 구성만 가리킵니다. 처음 나오는 구성에는 "상기"를 붙이지 않고, 같은 구성은 청구범위와 발명의 설명 전체에서 같은 용어로 씁니다. 청구항의 구성 용어는 발명의 설명에 같은 말로 나와야 합니다.
   - 2 이상의 항을 인용하는 청구항은 택일적으로 인용하고("청구항 1 또는 청구항 2에 있어서", "청구항 1 내지 청구항 3 중 어느 한 항에 있어서"), "및"으로 함께 인용하지 않으며, 다른 다중 인용항을 직접 또는 간접으로 다시 인용하지 않습니다(특허법 시행령 제5조). 자기 자신이나 뒤 번호의 청구항을 인용하지 않습니다.
   - 물건 청구항과 별도로, 근거가 있으면 제조방법·사용방법 독립항을 둡니다. 발명의 명칭 전체를 한 청구항 끝에 붙이지 말고, 물건과 방법은 서로 다른 청구항으로 씁니다. 공정 단계·조건은 조성물의 구성으로 넣지 말고 방법 청구항에 씁니다.
   - 장치 청구항은 구성요소를 나열만 하지 말고, 구성 사이의 연결·결합 관계와 각 구성이 하는 동작을 적습니다. 도면이 없으면 도면 부호를 붙이지 않습니다.
   - 조성물의 함량 범위는 "조성물 총 중량에 대하여 5 내지 20 중량%"처럼 기준을 밝힙니다.
   - 청구항에 불명확한 표현("약", "정도", "내외", "적정량", "적당량", "유효량", "다량", "소량", "등", "바람직하게는", "특히", "주로", "실질적으로", "거의", "필요에 따라", "예를 들어")을 쓰지 않습니다. 바람직한 범위나 예시는 발명의 설명에 씁니다. 수치 범위는 "5 내지 20 중량%", "30 내지 40 ℃"처럼 하한·상한과 단위를 함께 씁니다.
   - 사람을 치료·진단하는 방법은 청구하지 않습니다(조성물, 식품, 용도로 청구).
   - 모든 청구항은 발명의 설명에 의해 뒷받침되어야 합니다. 청구항의 수치 범위와 구성은 실시예 등 제공된 근거로 실질적으로 뒷받침되어야 하며, 근거 없이 문구만 발명의 설명에 옮겨 적어서는 안 됩니다. 근거가 없는 한정은 청구항으로 만들지 말고 검토메모에 적습니다.
4. 발명의 설명은 통상의 기술자가 반복 재현할 수 있도록 재료, 조건, 순서, 측정 방법을 구체적으로 씁니다. 실시예와 비교예를 구분하고, 제공된 결과 수치만 사용합니다.
5. 공지예외주장 대상이면 발명의 설명에 쓰지 말고 검토메모에 남깁니다(출원서에서 주장하는 사항).
5-1. 미생물을 적을 때는 학명과 수탁번호를 함께 적습니다. 기탁하지 않은 시판·공지 균주는 수탁번호 대신 입수 방법(분양 기관·번호)을 적습니다. 염기·아미노산 서열은 서열번호를 붙이고 서열목록을 따로 낸다고 검토메모에 적습니다.
6. 문체는 한국 특허 명세서 문체("~이다", "~할 수 있다", "상기 ~")를 씁니다. 마크다운 기호(#, *, **, -, \`\`\`, 표의 |---|)와 HTML 태그를 쓰지 않고, 영어 문장을 남기지 않습니다(학명·약어·영문 명칭만 원어로 씁니다).
7. 요약은 400자 이내로 씁니다.
8. 특허 등록 가능성이나 권리 범위를 보장하는 표현을 쓰지 않습니다. 판단이 필요한 사항은 검토메모에 적습니다.

[출력]
머리말 없이 【발명의 설명】으로 시작해 명세서 전문을 쓴 뒤, 마지막에 한 줄로 ${REVIEW_MARK} 를 쓰고 그 아래에 출원 전에 출원인·변리사가 확인할 사항을 "- "로 시작하는 줄로 나열합니다(〔입력 필요〕 항목의 요약, 거절 위험, 추가 실험 제안, 공지예외주장 여부 등).`;

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

// 명세서와 검토 메모를 나눈다. 코드 블록 표시·식별항목 앞의 # 기호·【 앞의 머리말은 명세서(제출 파일)에 남기지 않는다 (화면 splitReviewText 와 같은 규칙)
export function splitReview(text) {
  const t = String(text).replace(/^\s*```.*$/gm, ""), i = t.indexOf(REVIEW_MARK);
  const body = (i < 0 ? t : t.slice(0, i)).replace(/\*\*/g, "").replace(/^[ \t]*#{1,6}[ \t]*(?=【)/gm, "").trim();
  const spec = body.includes("【") ? body.slice(body.indexOf("【")) : body;
  const review = i < 0 ? [] : t.slice(i + REVIEW_MARK.length).split("\n").map(l => l.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
  return { spec, review };
}

export const draftEnabled = gatewayEnabled;

export async function draftSpec(input, { chatImpl = chat } = {}) {
  const msg = await chatImpl({ system: SYSTEM_PROMPT, user: buildUserPrompt(input), maxTokens: MAX_TOKENS });
  if (msg.finishReason === "content_filter") {
    throw Object.assign(new Error("명세서 작성 요청이 거절되었습니다. 발명 정보를 확인한 뒤 다시 시도하세요."), { status: 422 });
  }
  if (!msg.text.trim()) throw Object.assign(new Error("명세서가 생성되지 않았습니다. 다시 시도하세요."), { status: 502 });
  const out = splitReview(msg.text);
  // checks: 서식·청구항 자동 점검 결과 (specCheck.js, 화면의 최종 점검과 같은 규칙). 응답에 더한 항목이라 기존 필드는 그대로다
  return { ...out, truncated: msg.finishReason === "length", model: msg.model, checks: lintSpec(out.spec, { hasDrawings: input.hasDrawings }) };
}

// 게이트웨이 오류를 사용자에게 보여줄 HTTP 응답으로 바꾼다
export const draftErrorResponse = gatewayErrorResponse;
