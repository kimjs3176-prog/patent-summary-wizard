// KIPRIS 검색 결과를 아이디어 보강용 지표로 바꾸는 순수 함수 모음.
// 형태소 분석기 없이 동작하도록 한글은 글자 2-gram, 영문·숫자는 단어 단위로 비교한다.

const PARTICLES = /(으로써|으로서|에서의|에서|으로|에게|부터|까지|하는|되는|하여|하고|이며|이고|와의|과의|의|을|를|이|가|은|는|에|와|과|로|및|도)$/;
const STOP = new Set(["포함", "포함하는", "이용", "이용한", "방법", "제조", "제조방법", "조성물", "장치", "시스템", "발명", "본발명", "상기", "또는", "그리고", "따라", "위한", "있는", "있다", "통해", "관한", "것으로", "것을", "제공", "효과", "단계", "경우", "사용", "대한", "더욱", "보다", "구체적", "일실시예", "특징", "목적", "모의"]); // ‘모의’는 모의 모드 문헌의 [모의] 표시

export const normalize = s => String(s ?? "").toLowerCase().replace(/[^0-9a-z가-힣\s]/g, " ").replace(/\s+/g, " ").trim();

// ‘제조방법’·‘조성물’ 같은 흔한 말은 어느 특허에나 있어 겹침에서 뺀다
export function grams(text) {
  const out = new Map();
  for (const w of normalize(text).split(" ")) {
    if (!w || STOP.has(w) || STOP.has(stem(w))) continue;
    if (/[가-힣]/.test(w)) {
      if (w.length === 1) continue;
      for (let i = 0; i < w.length - 1; i++) { const g = w.slice(i, i + 2); out.set(g, (out.get(g) || 0) + 1); }
    } else if (w.length > 1) out.set(w, (out.get(w) || 0) + 1);
  }
  return out;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// 키워드 묶음(검색식의 줄) 가운데 몇 개가 문헌에 들어 있는지 (띄어 쓴 검색어는 낱말이 모두 있어야 한다)
export function groupCoverage(groups, it) {
  const gs = (groups ?? []).filter(g => g.length);
  if (!gs.length) return 1;
  const text = normalize(`${it.title} ${it.abstract}`).replace(/\s+/g, "");
  const has = t => normalize(t).split(" ").filter(Boolean).every(w => text.includes(w));
  return gs.filter(g => g.some(has)).length / gs.length;
}

// 유사도: 글자 2-gram 코사인(흔한 말은 grams 에서 뺀다)에 키워드 묶음 포함 비율을 곱한다. 키워드를 하나만 담은 문헌은 최대 60%까지 낮아진다
export function rankBySimilarity(ideaText, items, groups = null) {
  const g = grams(ideaText);
  return items
    .map(it => { const c = cosine(g, grams(`${it.title} ${it.title} ${it.abstract}`)), w = groups ? 0.6 + 0.4 * groupCoverage(groups, it) : 1; return { ...it, sim: Math.round(c * w * 100) }; })
    .sort((a, b) => b.sim - a.sim);
}

const docText = it => normalize(`${it.title} ${it.abstract}`);

// 키워드 그룹(동의어 묶음)별로 유사 문헌 중 몇 %가 언급하는지
export function keywordShare(groups, items) {
  const texts = items.map(docText);
  return groups.map(g => {
    const terms = g.map(normalize).filter(Boolean);
    const hits = texts.filter(t => terms.some(term => t.includes(term))).length;
    return { term: g.join("·"), hits, share: texts.length ? Math.round(hits / texts.length * 100) : 0 };
  });
}

export function stem(w) {
  let s = w;
  for (let i = 0; i < 2 && PARTICLES.test(s) && s.length > 2; i++) s = s.replace(PARTICLES, "");
  return s;
}

// 유사 문헌에 자주 나오지만 아이디어에는 없는 용어 (문서 빈도 기준)
export function frequentTerms(ideaText, items, { top = 12, minShare = 15 } = {}) {
  const idea = normalize(ideaText);
  const df = new Map();
  for (const it of items) {
    const seen = new Set(normalize(`${it.title} ${it.abstract}`).split(" ").map(stem)
      .filter(w => w.length >= 2 && /[가-힣a-z]/.test(w) && !STOP.has(w) && !/^\d+$/.test(w)));
    for (const w of seen) df.set(w, (df.get(w) || 0) + 1);
  }
  const n = items.length || 1;
  return [...df].map(([term, c]) => ({ term, hits: c, share: Math.round(c / n * 100), inIdea: idea.includes(term) }))
    .filter(t => t.share >= minShare)
    .sort((a, b) => b.hits - a.hits || a.term.localeCompare(b.term))
    .slice(0, top);
}

// 공백 맵: 출원 건수 행렬에서 공백 후보 칸 표시
export function gapMatrix(rows, cols, counts) {
  const flat = counts.flat().filter(v => Number.isFinite(v));
  const max = Math.max(1, ...flat);
  const threshold = Math.max(3, Math.round(max * 0.05));
  const cells = [];
  counts.forEach((r, ri) => r.forEach((v, ci) => { if (Number.isFinite(v) && v <= threshold) cells.push({ key: `${ri}-${ci}`, row: rows[ri], col: cols[ci], count: v }); }));
  cells.sort((a, b) => a.count - b.count);
  return { rows, cols, counts, max, threshold, gaps: cells };
}

// 거절 출원의 심사 이력에서 거절 유형을 추정한다 (거절이유 원문은 검색 API로 제공되지 않음)
export function inferRejection(detail) {
  const legal = detail?.legal ?? [];
  const has = re => legal.filter(l => re.test(l.name));
  const notices = has(/의견제출통지서/);
  const decisions = has(/거절결정서/);
  const amendments = has(/보정서/);
  const appeal = has(/심판|재심사/);
  const cited = (detail?.priorArt ?? []).filter(p => p.byExaminer);
  let category, basis;
  if (cited.length) { category = "선행문헌 인용 (신규성·진보성 계열)"; basis = `심사관 인용문헌 ${cited.length}건`; }
  else if (notices.length) { category = "인용문헌 없는 거절 (기재불비 등)"; basis = `의견제출통지 ${notices.length}회, 인용문헌 없음`; }
  else { category = "사유 확인 필요"; basis = "심사 이력 정보 부족"; }
  return {
    category, basis,
    notices: notices.length, decisions: decisions.length,
    amendedThenRejected: amendments.length > 0 && decisions.length > 0,
    appealed: appeal.length > 0,
    citedDocs: cited.map(c => c.number).filter(Boolean)
  };
}

export function rejectionSummary(cases) {
  const dist = new Map();
  for (const c of cases) dist.set(c.insight.category, (dist.get(c.insight.category) || 0) + 1);
  const n = cases.length || 1;
  return [...dist].map(([category, k]) => ({ category, count: k, share: Math.round(k / n * 100) })).sort((a, b) => b.count - a.count);
}

// 받침에 맞춘 조사: josa("발효", "은", "는") → "발효는"
const josa = (w, a, b) => { const c = String(w).trim().slice(-1).charCodeAt(0) - 0xac00; return w + (c >= 0 && c <= 11171 && c % 28 ? a : b); };
export function suggestions({ shares, frequent, gap, rejected, similar }) {
  const out = [];
  for (const s of shares) {
    if (s.share >= 50) out.push({ type: "crowded", text: `'${josa(s.term, "'은", "'는")} 유사 문헌 ${s.share}%에 나옵니다. 독립항의 차별점으로는 약하므로 구체적 조건(균주명, 온도·시간, 배합비)으로 한정하세요.`, basis: `유사 문헌 ${s.hits}건` });
    else if (s.share <= 10) out.push({ type: "distinct", text: `'${josa(s.term, "'은", "'는")} 유사 문헌의 ${s.share}%에만 나옵니다. 차별점으로 청구항과 실시예에서 강조하세요.`, basis: `유사 문헌 ${s.hits}건` });
  }
  const missing = frequent.filter(f => !f.inIdea).slice(0, 4);
  if (missing.length) out.push({ type: "check", text: `유사 문헌에 자주 나오는 ${missing.map(m => `'${m.term}'(${m.share}%)`).join(", ")}가 내 아이디어에는 없습니다. 같은 구성이 필요한지, 없다면 왜 없어도 되는지 명세서에 설명하세요.`, basis: "유사 문헌 용어 빈도" });
  for (const g of (gap?.gaps ?? []).slice(0, 3)) out.push({ type: "gap", text: `'${g.row} × ${g.col}' 조합의 출원은 ${g.count}건입니다. 실험으로 효과를 확인하면 종속항이나 용도 청구항으로 선점을 검토하세요.`, basis: "공백 맵", key: g.key });
  const cited = rejected?.cases?.filter(c => c.insight.citedDocs.length) ?? [];
  if (cited.length) out.push({ type: "risk", text: `비슷한 거절 출원 ${cited.length}건이 선행문헌 인용으로 거절되었습니다. 인용된 문헌(${[...new Set(cited.flatMap(c => c.insight.citedDocs))].slice(0, 3).join(", ")})과 직접 비교한 비교예를 준비하세요.`, basis: "거절 출원 심사 이력" });
  const noCite = rejected?.cases?.filter(c => !c.insight.citedDocs.length && c.insight.notices) ?? [];
  if (noCite.length) out.push({ type: "risk", text: `인용문헌 없이 거절된 출원이 ${noCite.length}건 있습니다. 기재불비 거절일 가능성이 높으니 '유효량' 같은 표현 대신 수치 범위와 실시예를 갖추세요.`, basis: "거절 출원 심사 이력" });
  const top = similar?.[0];
  if (top && top.sim >= 45) out.push({ type: "risk", text: `가장 비슷한 문헌(${top.applicationNumber}, 유사도 ${top.sim}%)과 구성이 많이 겹칩니다. 청구범위를 직접 대조해 보세요.`, basis: "문자 n-gram 유사도" });
  return out;
}

// 유사 특허의 IPC(메인 그룹) 빈도: "A01G 9/24|C05F 11/08" → [{ code: "A01G 9/24", count, share }]
export function ipcFrequency(items, top = 6) {
  const m = new Map();
  for (const it of items) {
    const codes = new Set(String(it.ipc || "").split(/[|,;]/).map(c => c.replace(/\s+/g, " ").trim().replace(/^([A-H]\d{2}[A-Z])\s*(\d+)\s*\/\s*(\d+).*$/, "$1 $2/$3")).filter(c => /^[A-H]\d{2}[A-Z] \d+\/\d+$/.test(c)));
    for (const c of codes) m.set(c, (m.get(c) || 0) + 1);
  }
  return [...m].map(([code, count]) => ({ code, count, share: items.length ? Math.round(count / items.length * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, top);
}

// 비슷한 특허를 대리한 대리인(특허사무소·변리사) — 대리 건수와 가장 비슷한 사례. 추천·평가가 아니라 공개 서지정보 집계다
export function agentSummary(items, details) {
  const m = new Map();
  items.forEach((it, i) => {
    for (const a of details[i]?.agents ?? []) {
      const key = a.code || a.name, row = m.get(key) || { name: a.name, count: 0, cases: [] };
      row.count++; if (row.cases.length < 3) row.cases.push({ applicationNumber: it.applicationNumber, title: it.title, sim: it.sim ?? 0 });
      m.set(key, row);
    }
  });
  return [...m.values()].sort((a, b) => b.count - a.count || (b.cases[0]?.sim ?? 0) - (a.cases[0]?.sim ?? 0)).slice(0, 6);
}

// 비슷한 특허 가운데 해외 출원인 (국적이 KR 이 아닌 출원인)
export function foreignApplicants(items, details) {
  const out = [];
  items.forEach((it, i) => { for (const a of details[i]?.applicants ?? []) if (a.country && a.country !== "KR" && !out.some(o => o.name === a.name)) out.push({ name: a.name, country: a.country, applicationNumber: it.applicationNumber }); });
  return out.slice(0, 8);
}

// 출원인 이름 정규화·유형 (대학 · 공공·연구기관 · 기업 · 개인·기타)
const corpRe = /주식회사|\(주\)|㈜|유한회사|농업회사법인|영농조합|협동조합|corporation|co\.,?\s*ltd|inc\.?|gmbh/i;
export const applicantKind = n => /대학교|대학|산학협력단|university/i.test(n) ? "대학" : /연구원|연구소|진흥청|진흥원|재단|공사|국립|센터|institute/i.test(n) ? "공공·연구기관" : corpRe.test(n) ? "기업" : "개인·기타";
export function topApplicants(items, top = 8) {
  const m = new Map();
  for (const it of items) for (const raw of String(it.applicant || "").split(/[|;]/)) {
    const name = raw.trim(); if (!name) continue;
    const key = name.replace(corpRe, "").replace(/[\s·.,()]/g, "").toLowerCase();
    const row = m.get(key) || { name, count: 0, kind: applicantKind(name) };
    row.count++; m.set(key, row);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, top);
}

