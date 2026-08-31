# Domain configuration surface

Everything institution-specific should be collapsed into one config module
(`src/config/domain.ts` + a mirrored constant block in the edge functions, since Deno
functions cannot import from `src/`).

```ts
export const DOMAIN = {
  serviceName: "Agri IP Summary",
  serviceAbbr: "AIS",
  subtitle: "농업기술 특허를 한눈에, AI로 쉽게",
  // 1. Applicant scope — server-side filter
  applicants: [
    "농촌진흥청", "국립농업과학원", "국립식량과학원",
    "국립원예특작과학원", "국립축산과학원", "한국농업기술진흥원",
  ],
  // 2. Keyword categories shown in the summary header
  keywordCategories: ["소재", "공정", "용도", "효과"],
  // 3. Law domains hinted to 국가법령정보 검색
  lawDomains: ["식품위생법", "농약관리법", "비료관리법", "종자산업법"],
  // 4. IPC prefixes used to boost in-field relevance
  ipcBoost: ["A01", "A23", "C12"],
};
```

## Applicant filtering

Filter on the KIPRIS `applicant`/`assignee` field with normalized comparison
(strip whitespace, 괄호, 법인격 접미사). Match on `includes` of the normalized
institution name — KIPRIS returns "대한민국(농촌진흥청장)" style strings.

Apply it in:
- `search-patents` (keyword, inventor, and number paths — all three)
- `fetch-patent` (reject out-of-scope before caching)
- `rda-latest-patents` / featured-patent fetchers

Missing one path is the classic bug: search is scoped but direct-number lookup is not.

## Keyword dictionary

Per category keep three lists:
- `include`: canonical terms for the field
- `requireContext`: ambiguous tokens that only count when adjacent to a qualifier
  (e.g. `상황`/`차가` only count as mushrooms when followed by `버섯` or a Latin name)
- `deny`: generic words that always leak (`기술`, `방법`, `장치`, `시스템`)

## Branding touchpoints

`index.html` (title/description/og), `src/pages/Index.tsx` hero, `PdfGenerator.tsx`
header brand rule + color, `src/lib/mcp/index.ts` name/title/instructions,
`public/manifest.webmanifest`, README.
