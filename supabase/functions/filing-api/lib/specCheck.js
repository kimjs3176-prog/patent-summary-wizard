// 명세서 자동 점검 — 특허법 제42조, 시행령 제5조, 시행규칙 제21조, 별지 제15·16호서식, WIPO ST.14 기준의 결정적 규칙.
// 서버는 AI 작성본의 응답(/api/draft 의 checks)에, 화면(index.html 의 checkSpec)은 최종 점검에 같은 코드를 쓴다.
// 화면은 빌드 없이 한 파일이라, index.html 의 specCheck:begin ~ specCheck:end 구간을 이 파일의 같은 구간과 글자 하나까지 똑같이 둔다
// (test/spec-check.test.js 가 확인한다. 여기를 고치면 node scripts/sync-spec-check.mjs 로 index.html 에 옮긴다).
// 브라우저 호환을 위해 정규식 뒤돌아보기((?<=…), (?<!…))는 쓰지 않는다.
// specCheck:begin
const SpecCheck = (() => {
  // 별지 제15·16호서식의 식별항목 순서 (해당할 때만 쓰는 항목 포함)
  const ORDER = ["【발명의 설명】", "【발명의 명칭】", "【기술분야】", "【발명의 배경이 되는 기술】", "【선행기술문헌】", "【특허문헌】", "【비특허문헌】",
    "【발명의 내용】", "【해결하려는 과제】", "【과제의 해결 수단】", "【발명의 효과】", "【도면의 간단한 설명】", "【발명을 실시하기 위한 구체적인 내용】",
    "【산업상 이용가능성】", "【부호의 설명】", "【수탁번호】", "【청구범위】", "【요약서】", "【요약】", "【대표도】"];
  const REQUIRED = ["【발명의 설명】", "【발명의 명칭】", "【발명의 배경이 되는 기술】", "【발명을 실시하기 위한 구체적인 내용】", "【청구범위】", "【청구항 1】", "【요약서】", "【요약】"];
  const RECOMMENDED = ["【기술분야】", "【발명의 내용】", "【해결하려는 과제】", "【과제의 해결 수단】", "【발명의 효과】"];
  const OLD = ["【해결하고자 하는 과제】", "【발명의 상세한 설명】", "【특허청구범위】"];
  // 청구항에 쓰면 범위가 불명확해지는 말 (특허법 제42조 제4항 제2호, 심사기준). 〔입력 필요〕 안은 보지 않는다
  const VAGUE = [/적정량|적당량|적량|유효량|다량|소량|대략/g, /약\s?\d[\d.,]*/g, /(^|[^가-힣])등(?=을|의|이|과|으로|에|은|를|\s|\.|,|$)/g,
    /바람직하게는|바람직한|바람직하다/g, /(^|[^가-힣])특히/g, /(^|[^가-힣])주로/g, /실질적으로|거의|대부분/g, /\d[^\s,]*\s*(?:정도|내외|전후)/g,
    /필요에 따라|필요시|경우에 따라|가능한 한|예를 들어|예컨대|예를 들면/g, /적절한|적절히|적당한|적당히/g];
  const UNIT = /^\s*(?:중량\s*부|중량\s*%|부피\s*%|몰\s*%|%|℃|°C|K\b|시간|분|초|일|주|개월|년|배|회|개|층|단계|nm|μm|um|mm|cm|m\b|km|kg|mg|μg|ng|g\b|mL|ml|μL|L\b|ppm|ppb|rpm|kPa|MPa|Pa\b|bar|lux|lx|kW|W\b|mV|V\b|mA|A\b|kHz|MHz|Hz|dS\/m|mS\/cm|mM|μM|M\b|N\b|CFU|cfu|log|°Bx|Brix|브릭스|kcal|cal|kJ|J\b|mol|bp|kb|nt|w\/w|v\/v|w\/v|메쉬|mesh)/;
  const ST14 = /^[A-Z]{2}\s+\d[\d\-\/]*\s+[A-Z]\d?(?:\s+\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.?)?$/;
  const PARTICLE = /(으로서|으로써|에서는|에서|으로|에게|에는|부터|까지|보다|와|과|은|는|이|가|을|를|의|에|로|도|만)$/;
  const REF = /(?:청구항\s*제?\s*(\d+)\s*항?|제\s*(\d+)\s*항)/g;
  const RANGE = /(?:청구항\s*제?\s*|제\s*)(\d+)\s*항?\s*(?:내지|~|∼)\s*(?:청구항\s*제?\s*|제\s*)?(\d+)/g;
  const unfill = s => String(s ?? "").replace(/〔[^〕]*〕/g, " ");
  const squash = s => String(s).replace(/\s+/g, "");
  const uniq = a => [...new Set(a)];
  const list = (a, n = 5) => a.slice(0, n).join(", ") + (a.length > n ? ` 외 ${a.length - n}곳` : "");

  function sections(text) {
    const t = String(text ?? "").replace(/\r/g, "");
    const ci = t.indexOf("【청구범위】"), si = t.indexOf("【요약서】");
    const desc = ci >= 0 ? t.slice(0, ci) : si >= 0 ? t.slice(0, si) : t;
    const claims = ci >= 0 ? t.slice(ci, si > ci ? si : undefined) : "";
    const tail = si >= 0 ? t.slice(si) : "";
    const summary = ((t.split("【요약】")[1] || "").split("【대표도】")[0]).trim();
    return { t, desc, claims, tail, summary };
  }

  // 청구항: 번호, 본문, 인용한 항(‘내지’는 사이 번호까지), 종속항 형식(‘…에 있어서’), 끝 명사(청구 대상)
  function parseClaims(text) {
    const sec = typeof text === "string" ? sections(text).claims : text.claims;
    return [...sec.matchAll(/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g)].map(m => {
      const body = m[2].trim(), bare = unfill(body), hits = [...bare.matchAll(REF)];
      const refs = hits.map(h => +(h[1] || h[2]));
      for (const r of bare.matchAll(RANGE)) { const a = +r[1], b = +r[2]; if (b > a && b - a < 100) for (let i = a + 1; i < b; i++) refs.push(i); }
      const span = hits.length ? bare.slice(hits[0].index, hits[hits.length - 1].index + hits[hits.length - 1][0].length + 16) : "";
      const subj = /〕\s*\.?\s*$/.test(body) ? "" : bare.replace(/[\s.]+$/, "").split(/\s+/).pop() || "";
      return { n: +m[1], body, refs: uniq(refs).sort((x, y) => x - y), dependent: /^\s*(?:청구항|제\s*\d+\s*항)[^,]*?에\s*있어서/.test(bare), span, subject: subj };
    });
  }

  function vagueTerms(claimText) {
    const s = unfill(claimText);
    return uniq(VAGUE.flatMap(re => [...s.matchAll(re)].map(m => m[0].replace(/^[^가-힣\d]+/, "").trim()))).filter(Boolean);
  }

  // ‘상기 X’의 X: 조사가 붙은 낱말까지(최대 5낱말). 조사가 끝내 없으면 첫 낱말만 본다
  function antecedentPhrases(body) {
    const s = unfill(body), out = [];
    for (const m of s.matchAll(/상기\s+(?=\S)/g)) {
      const toks = s.slice(m.index + m[0].length).split("\n")[0].split(/\s+/).slice(0, 5), got = [];
      let done = false;
      for (const tk of toks) {
        const w = tk.replace(/[,.;:]+$/, "");
        if (!w || /^(및|또는|중|내지)$/.test(w)) break;
        const p = w.match(PARTICLE);
        if (p && w.length > p[0].length) { got.push(w.slice(0, -p[0].length)); done = true; break; }
        got.push(w);
        if (w !== tk) break;
      }
      const phrase = (done ? got : got.slice(0, 1)).join(" ").trim();
      if (phrase && !/^[\d()]+$/.test(phrase)) out.push({ phrase, first: got[0], raw: (toks[0] || "").replace(/[,.;:]+$/, ""), at: m.index });
    }
    return out;
  }

  function lintSpec(text, opts = {}) {
    const S = sections(text), t = S.t, out = [];
    const add = (ok, title, d) => out.push({ ok: !!ok, t: title, d });

    const missing = REQUIRED.filter(h => !t.includes(h));
    add(!missing.length, "필수 항목", missing.length ? `빠진 항목: ${missing.join(", ")} (시행규칙 제21조, 별지 제15호서식)` : "명세서·요약서의 필수 식별항목이 모두 있습니다.");
    const rec = RECOMMENDED.filter(h => !t.includes(h));
    add(!rec.length, "권장 항목", rec.length ? `없는 항목: ${rec.join(", ")} — 해당 내용이 있으면 적으세요.` : "기술분야·발명의 내용·과제·해결 수단·효과 항목이 있습니다.");
    const old = OLD.filter(h => t.includes(h));
    add(!old.length, "항목 이름", old.length ? `${old.join(", ")}은(는) 현행 서식의 이름이 아닙니다. 【해결하려는 과제】, 【발명을 실시하기 위한 구체적인 내용】, 【청구범위】로 고치세요.` : "식별항목 이름이 현행 서식과 같습니다.");

    // 식별항목 순서·중복
    const pos = ORDER.map(h => [h, t.indexOf(h)]).filter(x => x[1] >= 0);
    const swapped = pos.findIndex((x, i) => i > 0 && x[1] < pos[i - 1][1]);
    const dup = ORDER.filter(h => t.split(h).length > 2);
    add(swapped < 0 && !dup.length, "식별항목 순서", swapped >= 0 ? `${pos[swapped][0]}이(가) ${pos[swapped - 1][0]}보다 앞에 있습니다. 별지 제15·16호서식의 순서대로 옮기세요.` : dup.length ? `${dup.join(", ")}이(가) 두 번 이상 나옵니다. 한 번만 쓰세요.` : "식별항목이 서식의 순서대로 한 번씩 있습니다.");

    const titleLine = (t.match(/【발명의 명칭】[^\n]*/) || [""])[0];
    const ko = (titleLine.match(/【발명의 명칭】[ \t]*([^\n{]*)/) || [])[1]?.trim() || "";
    const titleOk = !!ko && /\{[^}]*[A-Za-z][^}]*\}/.test(titleLine);
    add(titleOk, "발명의 명칭", titleOk ? "국문 명칭과 {영문 명칭}이 한 줄에 있습니다." : "【발명의 명칭】 다음에 국문 명칭과 {영문 명칭}을 같은 줄에 적으세요. 예: 발효 쌀겨 조성물{FERMENTED RICE BRAN COMPOSITION}");

    // 식별번호: 【0001】부터 이어지고, 청구범위·요약서에는 붙이지 않는다
    const paras = [...t.matchAll(/【(\d{4})】/g)].map(m => +m[1]);
    const seqOk = paras.length > 0 && paras.every((n, i) => n === i + 1);
    const late = /【\d{4}】/.test(S.claims + S.tail);
    add(seqOk && !late, "문단 번호", !seqOk ? (paras.length ? "문단 번호가 빠졌거나 순서가 맞지 않습니다. 【0001】부터 하나씩 이어 붙이세요." : "문단 번호가 없습니다. 【기술분야】부터 각 문단 앞에 【0001】처럼 네 자리 번호를 붙이세요.")
      : late ? "【청구범위】와 【요약서】에는 식별번호(【0001】)를 붙이지 않습니다 (별지 제15호서식 기재요령)." : `【0001】부터 【${String(paras.length).padStart(4, "0")}】까지 차례대로 붙어 있습니다.`);

    const claims = parseClaims(S), byN = new Map(claims.map(c => [c.n, c]));
    const numOk = claims.length > 0 && claims.every((c, i) => c.n === i + 1);
    add(numOk, "청구항 번호", claims.length ? `청구항 ${claims.length}개${numOk ? "" : ", 번호가 1부터 연속되지 않습니다"}` : "청구항이 없습니다.");

    // 인용: 자기 자신·뒤 번호·없는 항을 인용하지 않는다 (시행령 제5조 제7항)
    const badRef = claims.filter(c => c.refs.some(r => r >= c.n || !byN.has(r))).map(c => c.n);
    add(!badRef.length, "인용 관계", badRef.length ? `청구항 ${badRef.join(", ")}이(가) 자기 자신, 뒤 번호 또는 없는 청구항을 인용합니다 (시행령 제5조 제7항).` : "모든 종속항이 앞 번호 청구항을 인용합니다.");
    // 다중 인용: 택일적으로 쓰고, 다른 다중 인용항을 직접·간접으로 인용하지 않는다 (시행령 제5조 제6항)
    const multi = c => c.refs.length > 1;
    const notAlt = claims.filter(c => multi(c) && !/또는|중\s*어느\s*(?:한\s*)?(?:하나의?\s*)?항/.test(c.span)).map(c => c.n);
    const multiOnMulti = claims.filter(c => {
      if (!multi(c)) return false;
      const seen = new Set(), stack = [...c.refs];
      while (stack.length) { const r = stack.pop(); if (seen.has(r) || r >= c.n) continue; seen.add(r); const p = byN.get(r); if (!p) continue; if (multi(p)) return true; stack.push(...p.refs); }
      return false;
    }).map(c => c.n);
    const multiBad = [multiOnMulti.length && `청구항 ${multiOnMulti.join(", ")}이(가) 다른 다중 인용항을 직접 또는 간접으로 인용합니다 (시행령 제5조 제6항).`,
      notAlt.length && `청구항 ${notAlt.join(", ")}은(는) 2 이상의 항을 택일적으로 인용하지 않습니다. ‘청구항 1 또는 청구항 2에 있어서’, ‘청구항 1 내지 청구항 3 중 어느 한 항에 있어서’처럼 쓰세요 (시행령 제5조 제6항).`].filter(Boolean);
    add(!multiBad.length, "다중 인용", multiBad.join(" ") || "다중 인용항은 택일적으로 쓰였고 다른 다중 인용항을 인용하지 않습니다.");

    // 종속항은 인용하는 항과 같은 대상으로 끝난다 (조성물 항을 인용한 종속항이 방법으로 끝나면 범주가 바뀐 것)
    const offSubj = claims.filter(c => c.dependent && c.subject).flatMap(c => c.refs.map(r => byN.get(r)).filter(p => p && p.n < c.n && p.subject && p.subject !== c.subject).map(p => `청구항 ${c.n}(‘${c.subject}’으로 끝남, 인용한 청구항 ${p.n}의 대상은 ‘${p.subject}’)`));
    add(!offSubj.length, "종속항 대상", offSubj.length ? `${list(offSubj, 3)}: ‘…에 있어서’로 인용한 항과 끝 대상이 다릅니다. 같은 대상으로 끝내거나, 범주가 다르면 ‘청구항 1의 …를 제조하는 방법’처럼 독립항 형식으로 쓰세요.` : "종속항이 인용하는 청구항과 같은 대상으로 끝납니다.");

    // ‘상기 X’의 선행 기재: 그 청구항의 앞부분이나 인용한 청구항(간접 포함)에 X가 먼저 나와야 한다
    const ancestors = c => { const seen = new Set(), stack = [...c.refs]; while (stack.length) { const r = stack.pop(); if (seen.has(r) || r >= c.n) continue; seen.add(r); stack.push(...(byN.get(r)?.refs ?? [])); } return unfill([...seen].map(r => byN.get(r)?.body ?? "").join("\n")); };
    const noBasis = [], unsupported = [], descFlat = squash(unfill(S.desc).replace(/【[^】]*】/g, " "));
    for (const c of claims) {
      const anc = ancestors(c), bare = unfill(c.body);
      for (const a of antecedentPhrases(c.body)) {
        const before = squash(`${anc}\n${bare.slice(0, a.at)}`), head = a.phrase.split(" ").pop();
        const known = w => w.length >= 2 && before.includes(squash(w));
        if (!known(a.phrase) && !known(a.raw) && !known(head) && !known(a.first)) noBasis.push(`청구항 ${c.n}의 ‘상기 ${a.phrase}’`);
        if (S.desc && a.phrase.split(" ").length <= 3 && !descFlat.includes(squash(a.phrase)) && !descFlat.includes(squash(a.raw))) unsupported.push(`청구항 ${c.n}의 ‘${a.phrase}’`);
      }
      // 물건 독립항의 구성요소(‘A, B 및 C를 포함하는’)가 발명의 설명에 같은 말로 나오는지
      if (!c.refs.length && S.desc && !/(방법|공정)$/.test(c.subject)) {
        const m = bare.match(/^([\s\S]+?)(?:을|를)\s*(?:포함|함유|구비)하(?:는|고|며)/);
        const els = m ? m[1].split(/,\s*|\s+및\s+|;\s*/).map(x => x.replace(/^\s*(?:\([a-z0-9]+\)\s*)?/, "").trim()).filter(x => x && x.length <= 30 && !/\d/.test(x)) : [];
        if (els.length <= 8) for (const e of els) if (!descFlat.includes(squash(e))) unsupported.push(`청구항 ${c.n}의 ‘${e}’`);
      }
    }
    add(!noBasis.length, "선행 기재(상기)", noBasis.length ? `${list(uniq(noBasis))}: 그 청구항이나 인용한 청구항에 앞서 나오지 않은 구성을 ‘상기’로 가리킵니다. 처음 나오는 구성에는 ‘상기’를 빼고, 앞의 구성과 같은 말로 쓰세요 (특허법 제42조 제4항 제2호).` : "청구항의 ‘상기 …’가 모두 앞에 나온 구성을 가리킵니다.");
    add(!unsupported.length, "청구항 용어 뒷받침", unsupported.length ? `${list(uniq(unsupported))}이(가) 발명의 설명에 같은 말로 나오지 않습니다. 발명의 설명에 그 구성을 같은 용어로 적어 뒷받침하세요 (특허법 제42조 제4항 제1호).` : "청구항의 구성 용어가 발명의 설명에 같은 말로 나옵니다.");

    const vague = vagueTerms(S.claims);
    add(!vague.length, "불명확한 표현", vague.length ? `청구항에 ${vague.map(v => `'${v}'`).join(", ")} 표현이 있습니다. 수치나 구체적 구성으로 바꾸세요 (특허법 제42조 제4항 제2호).` : "청구항에 불명확한 표현이 없습니다.");

    // 수치 범위에는 단위를 쓴다 (pH·탄소수·서열번호·청구항 번호·비율은 단위 없이 쓴다)
    const claimBare = unfill(S.claims), noUnit = [];
    for (const m of claimBare.matchAll(/\d+(?:[.,]\d+)?\s*(?:내지|~|∼)\s*\d+(?:[.,]\d+)?/g)) {
      const before = claimBare.slice(Math.max(0, m.index - 8), m.index), after = claimBare.slice(m.index + m[0].length);
      if (/(pH|탄소수|서열번호|청구항|제|:|\^)\s*$/.test(before) || /^\s*(?::|항|번)/.test(after) || UNIT.test(after)) continue;
      noUnit.push(m[0].trim());
    }
    add(!noUnit.length, "수치 단위", noUnit.length ? `청구항의 수치 범위 ${uniq(noUnit).map(x => `'${x}'`).join(", ")}에 단위가 없습니다. ‘5 내지 20 중량%’처럼 단위와 기준을 함께 쓰세요.` : "청구항의 수치 범위에 단위가 있습니다.");

    add(S.summary.length > 0 && S.summary.length <= 400, "요약 길이", S.summary ? `${S.summary.length}자 (400자 이내, 별지 제16호서식)` : "요약이 비어 있습니다.");

    // 선행기술문헌: WIPO ST.14 표기, 번호 연속, 본문이 가리키는 문헌이 목록에 있는지
    const cites = [...S.desc.matchAll(/(^|[^비])\(특허문헌\s*(\d+)\)\s*([^\n]*)/g)].map(m => ({ n: +m[2], cite: m[3].trim() }));
    const said = uniq([...S.desc.replace(/\(특허문헌\s*\d+\)/g, " ").matchAll(/(^|[^비])특허문헌\s*(\d+)/g)].map(m => +m[2]));
    if (cites.length || said.length || t.includes("【선행기술문헌】")) {
      const offForm = cites.filter(c => !/〔/.test(c.cite) && !ST14.test(c.cite)).map(c => `(특허문헌 ${c.n}) ${c.cite.slice(0, 40)}`);
      const gap = !cites.every((c, i) => c.n === i + 1), dangling = said.filter(n => !cites.some(c => c.n === n));
      const head = t.includes("【선행기술문헌】") && !/【특허문헌】|【비특허문헌】/.test(t);
      add(!offForm.length && !gap && !dangling.length && !head, "선행문헌 표기", head ? "【선행기술문헌】 아래에 【특허문헌】 또는 【비특허문헌】 항목을 두세요."
        : dangling.length ? `본문의 특허문헌 ${dangling.join(", ")}이(가) 【특허문헌】 목록에 없습니다. 목록에 없는 문헌은 인용하지 마세요.`
        : gap ? "특허문헌 번호가 1부터 이어지지 않습니다."
        : offForm.length ? `${list(offForm, 3)}: WIPO ST.14 표기(예: KR 10-2020-0012345 A 2020. 2. 3.)가 아닙니다. 공개·등록번호가 없는 출원은 아직 공개 전일 수 있으니 선행기술문헌이 되는지 확인하세요.`
        : `특허문헌 ${cites.length}건이 ST.14 표기로 적혀 있습니다.`);
    }

    // 도면: 낼 때만 도면 설명·부호·대표도를 쓰고, 본문이 가리키는 도면·부호가 목록과 맞아야 한다
    if (typeof opts.hasDrawings === "boolean") {
      const draw = opts.hasDrawings, hasDesc = t.includes("【도면의 간단한 설명】"), hasRep = t.includes("【대표도】"), hasSign = t.includes("【부호의 설명】");
      const figSec = hasDesc ? t.split("【도면의 간단한 설명】")[1].split(/【발명을 실시하기 위한 구체적인 내용】|【청구범위】/)[0] : "";
      const figs = new Set([...figSec.matchAll(/【도\s*(\d+)】/g)].map(m => +m[1]));
      const used = uniq([...unfill(S.desc.replace(figSec, " ")).matchAll(/(^|[^가-힣【])도\s*(\d+)(?=[^\d]|$)/g)].map(m => +m[2]));
      const rep = (S.tail.split("【대표도】")[1] || "").match(/도\s*(\d+)/);
      const signSec = hasSign ? t.split("【부호의 설명】")[1].split(/【수탁번호】|【청구범위】/)[0] : "";
      const signs = new Set([...signSec.matchAll(/(\d{2,4}[a-z]?)\s*[:：]?\s*[가-힣A-Za-z]/g)].map(m => m[1]));
      const signUsed = uniq([...unfill(S.desc.replace(signSec, " ") + S.claims).matchAll(/[가-힣A-Za-z]\s?\((\d{2,4}[a-z]?)\)/g)].map(m => m[1]));
      let d = "";
      if (!draw && (hasDesc || hasRep || hasSign)) d = "도면이 없으면 【도면의 간단한 설명】, 【부호의 설명】, 【대표도】 항목을 지우세요 (별지 제16호서식 기재요령 1.사.(3)).";
      else if (draw && (!hasDesc || !hasRep)) d = "도면을 낸다고 했는데 【도면의 간단한 설명】 또는 【대표도】가 없습니다.";
      else if (draw && figs.size && used.some(n => !figs.has(n))) d = `본문의 도 ${used.filter(n => !figs.has(n)).join(", ")}이(가) 【도면의 간단한 설명】에 없습니다.`;
      else if (draw && rep && figs.size && !figs.has(+rep[1])) d = `【대표도】의 도 ${rep[1]}이(가) 【도면의 간단한 설명】에 없습니다.`;
      else if (draw && hasSign && signUsed.some(s => !signs.has(s))) d = `부호 ${signUsed.filter(s => !signs.has(s)).slice(0, 6).join(", ")}이(가) 【부호의 설명】에 없습니다.`;
      else if (draw && hasSign && [...signs].some(s => !signUsed.includes(s))) d = `【부호의 설명】의 부호 ${[...signs].filter(s => !signUsed.includes(s)).slice(0, 6).join(", ")}이(가) 본문에 쓰이지 않습니다.`;
      add(!d, "도면", d || (draw ? "도면 설명과 【대표도】가 있습니다. 도면 이미지(흑백 TIFF 300dpi)를 함께 내세요." : "도면 없이 출원합니다. 【도면의 간단한 설명】과 【대표도】가 없습니다."));
    }

    // 제출 파일에 남으면 안 되는 것: 마크다운·HTML 기호, 서식에 없는 식별항목, 검토 메모 구분 표시, 번역되지 않은 영어 문장
    const noParen = S.t.replace(/\([^()]*\)|\{[^{}]*\}|〔[^〕]*〕/g, " ").replace(/^【\d{4}】\s*\((?:비)?특허문헌[^\n]*$/gm, " ");
    const marks = [[/^\s{0,3}#{1,6}\s/m, "# 제목 기호"], [/```/, "``` 코드 블록"], [/\*\*|__/, "** 굵게 기호"], [/^\s*[-*•]\s+\S/m, "글머리 기호(- , * )"], [/\|\s*:?-{3,}/, "마크다운 표 구분선"],
      [/<\/?(?:br|p|div|span|b|i|sup|sub|table|tr|td)\b[^>]*>/i, "HTML 태그"], [/<<<검토메모>>>/, "검토 메모 구분 표시"], [/【(?:비교예|실험예)\s*\d*】/, "서식에 없는 【비교예】·【실험예】 항목"],
      [/(?:[A-Za-z][A-Za-z'-]*[ ,]+){5,}[A-Za-z]/, "번역되지 않은 영어 문장"]].filter(([re]) => re.test(noParen)).map(x => x[1]);
    add(!marks.length, "서식 기호", marks.length ? `남아 있는 것: ${marks.join(", ")}. 서식작성기·Word에 그대로 들어가니 지우세요 (비교예·실험예는 문단 첫머리 <비교예 1>처럼 씁니다).` : "마크다운·HTML 기호나 서식에 없는 항목이 없습니다.");
    return out;
  }

  return { lintSpec, parseClaims, vagueTerms, antecedentPhrases, sections, ORDER };
})();
// specCheck:end

export const { lintSpec, parseClaims, vagueTerms, antecedentPhrases, sections, ORDER } = SpecCheck;
