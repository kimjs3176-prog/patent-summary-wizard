---
name: patent-ai-summary-platform
description: Build or port a patent AI search/summary/commercialization-scoring/regulation-matching service for any institution, technology field, patent office API, LLM provider, and web stack. Use when a request involves institution-scoped patent portfolios, AI patent summaries, TRL or commercialization scoring, patent PDF reports, or exposing patent tooling as MCP.
---

# Patent AI Summary Platform (stack-agnostic)

A portable blueprint for a service that searches an institution's patent portfolio,
generates AI summaries, scores commercialization potential, matches regulations, and
publishes the result as web pages, PDF reports, and MCP tools.

Nothing here is tied to a specific framework, runtime, database, patent office, or model
vendor. Stack-specific wiring lives in `references/stack-adapters.md`.

## Architecture (contracts, not code)

```text
user input (patent number / keyword / inventor / batch list)
        │
        ├─ search-patents               office API + applicant scope + IDF ranking
        ├─ fetch-patent                 bibliographic, claims, abstract, drawings (cached)
        ├─ summarize-patent             LLM streaming summary
        ├─ analyze-commercialization    tech / market / business scores + TRL
        ├─ analyze-regulations          statute lookup for the tech field
        └─ recommend-similar-patents
        │
   web summary view → PDF report → MCP tools (agents)
```

Each bullet is one server endpoint with a stable JSON contract
(`references/pipeline.md`). Swap the runtime freely; keep the contracts.

## The five variables when porting

Everything else is reusable. Change exactly these:

| # | Variable | Where defined | Reference |
| --- | --- | --- | --- |
| 1 | Institution scope (applicant whitelist) | domain config, enforced server-side | `references/domain-config.md` |
| 2 | Domain keyword dictionary + false-positive guards | domain config | `references/domain-config.md` |
| 3 | Commercialization rubric, weights, score bands, TRL evidence rules | scoring prompt | `references/scoring.md` |
| 4 | Regulation/statute domain hints and law-search API | regulation endpoint | `references/pipeline.md` |
| 5 | Branding: name, subtitle, metadata, palette, MCP server identity | UI + MCP config | `references/mcp.md` |

Then choose the stack bindings: patent office API, LLM provider, cache/store,
server runtime, PDF renderer — see `references/stack-adapters.md`.

## Hard rules (learned the hard way)

- **Applicant filter runs server-side, on every path** — keyword, inventor, direct
  number lookup, featured lists. Client-side filtering leaks out-of-scope patents into
  caches and MCP responses. Scoping search but not number lookup is the classic bug.
- **No fabricated summaries.** If the office API returns no usable title/abstract/claims,
  abort before calling the LLM and surface an error.
- **Score lock.** Persist the commercialization result keyed by patent number and only
  recompute on explicit regeneration. Re-scoring per view destroys trust.
- **Cache upstream payloads** (7-day TTL is a good default). Patent office APIs are slow
  and rate-limited; batch mode must run at concurrency 1 with inter-request delay.
- **Non-Latin PDF text needs an embedded font**, applied per text run — mixing a mono
  Latin face with CJK/Cyrillic strings breaks glyphs silently.
- **Never post-process grammar with regex** (particles, inflection, agreement).
  It corrupts words. Enforce writing rules in the prompt instead.
- **Keyword extraction reads the generated summary body**, then validates each keyword
  against the title/abstract; discard keywords that appear once and are unrelated.
- **Bold/emphasis, if used, marks complete noun phrases only** — never trailing
  particles, verbs, or clause fragments.

## References

| Need | Read |
| --- | --- |
| Config surface to change per institution | `references/domain-config.md` |
| Endpoint contracts and prompt structure | `references/pipeline.md` |
| Scoring / TRL rubric design | `references/scoring.md` |
| Exposing the service as MCP tools | `references/mcp.md` |
| Binding to a concrete stack (runtime, office API, LLM, PDF) | `references/stack-adapters.md` |

## Done criteria

- 3 in-scope patent numbers → summary renders fully, score present, no empty sections.
- 1 out-of-scope patent → rejected or clearly marked.
- 1 keyword search + 1 inventor search → ranked, dead/rejected rights excluded.
- PDF export → correct glyphs, headers, page folios.
- MCP `search_patents` + `summarize_patent` against the deployed URL → 200 with content.
