# Endpoint contracts

Six endpoints, any runtime. All return `{ success, data | error }` envelopes, set CORS
headers, and wrap upstream calls in timeout + exponential-backoff retry.

## search-patents
`POST { keyword, count?, source? }` → `{ success, total, results[] }`

- Runs parallel source queries: title / abstract / inventor.
- Ranking: term frequency × IDF, plus classification-prefix boost from `DOMAIN.ipcBoost`.
- Inventor detection uses a surname/name-pattern whitelist so short personal names are
  not treated as technical nouns.
- Excludes rejected/lapsed rights and filings older than the term limit (20 years).
- Applicant filter applied before ranking.

## fetch-patent
`POST { patentNumber, forceRegenerate? }` → `{ success, data, relatedPatents }`

- Cache keyed by normalized patent number, 7-day TTL.
- Returns title, abstract, claims[], applicant, inventors[], filingDate,
  classifications[], drawings[] (deduplicated, proxied for SSRF safety).

## summarize-patent
`POST { patentNumber, patentData, forceRegenerate? }` → streaming text deltas

Keep the section order stable — the client parser depends on it:
core technology / problem / solution / quantitative effects / applications / market.

Prompt rules worth keeping verbatim:
- Narrative prose a non-expert can follow; never paste specification sentences.
- Only numbers present in the source; otherwise state that the spec gives none.
- Market figures carry an inline `(source, year)` attribution in the sentence itself.
- Emphasis, if used, wraps complete noun phrases only — no particles or verbs.

Client responsibilities: usable-data gate before calling, 3-attempt retry with
1.5s/4s backoff on retryable errors, empty-stream detection, busy flag to block
concurrent generation.

## analyze-commercialization
`POST { patentNumber }` → `{ success, analysis }` — see `scoring.md`.

## analyze-regulations
`POST { patentNumber, tech_field? }` → LLM extracts regulation keywords from the
technical field, queries the jurisdiction's statute-search API, returns matched statutes
with the reason each applies. Seed extraction with `DOMAIN.lawDomains`. If the
jurisdiction has no open statute API, degrade to a curated statute table rather than
letting the model invent law names.

## recommend-similar-patents
`POST { patentNumber }` → similar patents plus a one-line match rationale, filtered by
the same applicant scope.

## Swapping the patent office

Only `search-patents` and `fetch-patent` touch the source. Keep their response shapes
identical and any office API drops in without touching summary, scoring, regulation,
PDF, or MCP layers. See `stack-adapters.md`.
