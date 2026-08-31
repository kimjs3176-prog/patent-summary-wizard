# Edge function pipeline contracts

All functions are Deno edge functions with CORS headers, `fetchWithRetry`
(timeout + exponential backoff), and JSON `{ success, data|error }` envelopes.

## search-patents
`POST { keyword, count?, source? }` → `{ success, total, results[] }`

- Runs parallel KIPRIS queries: 발명의명칭 / 초록 / 발명자.
- Ranking: term frequency × IDF, plus IPC-prefix boost from `DOMAIN.ipcBoost`.
- Inventor detection uses a surname whitelist so 2–3자 인명 is not treated as a noun.
- Excludes 거절 / 소멸 status and applications older than 20 years from filing.
- Applicant filter applied before ranking.

## fetch-patent
`POST { patentNumber, forceRegenerate? }` → `{ success, data, relatedPatents }`

- 7-day cache keyed by normalized patent number.
- Returns title, abstract, claims[], assignee, inventors[], filingDate,
  classifications[], drawings[] (deduplicated, proxied via `proxy-image` for SSRF safety).

## summarize-patent
`POST { patentNumber, patentData, forceRegenerate? }` → SSE stream (OpenAI-style deltas)

Prompt structure (keep the section order — the frontend parser depends on it):
핵심 기술 / 해결하려는 문제 / 핵심 해결 수단 / 정량적 효과 / 사업화 활용 분야 / 시장 동향.

Rules to keep in the prompt:
- 일반 사용자가 이해할 수 있는 서술형, 명세서 문장 복붙 금지.
- 수치는 원문에 있는 값만. 없으면 "명세서에 수치 미기재".
- 시장 동향의 수치 뒤에는 `(기관명, 연도)` 형태로 출처를 본문에 직접 표기.
- 볼드는 의미 단위 명사구로만, 조사·서술어 포함 금지.

Client (`usePatentSummary.ts`) handles: usable-data gate, 3-attempt retry with
1.5s/4s backoff on retryable messages, empty-stream detection, `__APP_BUSY__` flag.

## analyze-commercialization
`POST { patentNumber }` → `{ success, analysis }` — see `scoring.md`.

## analyze-regulations
`POST { patentNumber, tech_field? }` → LLM extracts regulation keywords from the
technical field, then queries 국가법령정보 API, returns matched 법령 + 적용 사유.
Seed the keyword extraction with `DOMAIN.lawDomains`.

## Adapting to a non-KIPRIS source

Only `search-patents` and `fetch-patent` touch the source API. Keep their response
shapes identical and any patent office (USPTO, EPO OPS, WIPO) drops in without
touching summary, scoring, PDF, or MCP layers.
