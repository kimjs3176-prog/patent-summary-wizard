// Post-process AI-generated markdown so bold ranges fall on natural word boundaries.
// - Unwrap bolds that span too many tokens or grammar fragments (e.g. "**위험이 있었으나 본 기술**")
// - Move trailing Korean particles outside of bold (e.g. "**바이오매스를**" → "**바이오매스**를")
// - Move leading connective words outside of bold (e.g. "**아니라 높은 내구성**" → "아니라 **높은 내구성**")

// Conjunctions/connectives we never want to lead a bold range.
const LEADING_CONNECTIVES = [
  "아니라", "또한", "그리고", "하지만", "그러나", "다만", "한편", "반면", "나아가",
  "특히", "구체적으로", "이와", "이러한", "이는", "그러한", "이와 달리",
];

// Predicate / clause fragments that mean the bold is wrapping a clause, not a term.
const CLAUSE_MARKERS = /(았|었|였|있었|있던|있는|있다|되었|되는|된다|이었|이며|이고|이지만|있었으나|되며|이라는|이라고|이나|그러나|하지만|아니라|및|또한)/;

// Trailing Korean particles / endings that should be moved outside the bold.
// Order matters — longest match first.
const TRAILING_JOSA = /(으로써|으로서|으로부터|에서의|에서|에게|이라는|이라고|이라|라는|로서|로써|으로|로|이며|이고|이나|이라|이다|입니다|하는|하여|하면|할\s*수|을|를|이|가|은|는|의|에|와|과|도|만|이나|나|이며|며|이고|고)$/u;

function trimBold(inner: string): { lead: string; core: string; trail: string } {
  let core = inner.trim();
  let lead = "";
  let trail = "";

  // Move leading connective words out
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hit = LEADING_CONNECTIVES.find(c => core === c || core.startsWith(c + " "));
    if (!hit) break;
    lead += hit + " ";
    core = core.slice(hit.length).trimStart();
  }

  // Strip trailing particles repeatedly (e.g. "바이오매스를" → "바이오매스")
  for (let i = 0; i < 2; i++) {
    const m = core.match(TRAILING_JOSA);
    if (!m) break;
    // Don't strip if doing so leaves <2 chars
    if (core.length - m[0].length < 2) break;
    trail = m[0] + trail;
    core = core.slice(0, core.length - m[0].length);
  }

  return { lead, core, trail };
}

export function sanitizeBoldMarkers(text: string): string {
  if (!text || !text.includes("**")) return text;
  return text.replace(/\*\*([^*\n]{1,80})\*\*/g, (_match, raw: string) => {
    const inner = raw.trim();
    if (!inner) return "";

    // Count tokens — if too many words or contains a clause marker, unwrap entirely.
    const tokenCount = inner.split(/\s+/).filter(Boolean).length;
    if (tokenCount >= 4 || CLAUSE_MARKERS.test(inner)) {
      return inner;
    }

    const { lead, core, trail } = trimBold(inner);
    if (!core) return lead + trail;
    // After trimming, if it's basically a single particle, just unwrap.
    if (core.length < 2) return lead + core + trail;
    return `${lead}**${core}**${trail}`;
  });
}
