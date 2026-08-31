# Domain configuration surface

Collapse everything institution-specific into a single config module, and mirror it as a
constant block wherever the server runtime cannot import from the web app's source tree.

```ts
export const DOMAIN = {
  serviceName: "Agri IP Summary",
  serviceAbbr: "AIS",
  subtitle: "농업기술 특허를 한눈에, AI로 쉽게",
  locale: "ko-KR",
  // 1. Applicant scope — enforced server-side
  applicants: [
    "농촌진흥청", "국립농업과학원", "국립식량과학원",
    "국립원예특작과학원", "국립축산과학원", "한국농업기술진흥원",
  ],
  // 2. Keyword categories shown in the summary header
  keywordCategories: ["소재", "공정", "용도", "효과"],
  // 3. Statute domains hinted to the law-search API
  lawDomains: ["식품위생법", "농약관리법", "비료관리법", "종자산업법"],
  // 4. Classification prefixes (IPC/CPC) boosted as in-field
  ipcBoost: ["A01", "A23", "C12"],
};
```

Values above are the reference deployment. Replace all of them when porting — a leftover
whitelist silently turns the service into an unscoped patent browser and every
downstream score becomes meaningless.

## Applicant filtering

Compare on the normalized applicant/assignee field (strip whitespace, brackets, legal
form suffixes) with `includes` against the normalized institution name.

Apply it in **every** retrieval path:
- keyword search, abstract search, inventor search
- direct patent-number lookup (reject out-of-scope before caching)
- featured / latest / recommendation fetchers

## Keyword dictionary

Per category keep three lists:
- `include`: canonical terms of the field
- `requireContext`: ambiguous tokens that count only next to a qualifier
  (e.g. a word that is both a common noun and a species name only counts when followed
  by the category suffix or a Latin binomial)
- `deny`: generic leakers (`기술`, `방법`, `장치`, `시스템` / method, system, apparatus)

Extraction reads the generated summary body, then validates each candidate against the
title and abstract; drop single-occurrence unrelated terms.

## Branding touchpoints

HTML head (title/description/OG), hero/landing copy, PDF header brand rule and accent
color, MCP server name/title/instructions, web manifest, README, and any email or share
templates.
