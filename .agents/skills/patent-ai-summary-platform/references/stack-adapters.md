# Stack adapters

The blueprint assumes only four capabilities. Pick any implementation per column; the
endpoint contracts in `pipeline.md` do not change.

| Capability | Options | Requirement |
| --- | --- | --- |
| Server runtime | serverless functions (Deno/Node/Python), a Node/FastAPI/Rails service, or route handlers in the web framework | must support streaming responses (SSE or chunked) for the summary endpoint |
| Patent source | KIPRIS (KR), USPTO PatentsView / Patent Public Search, EPO OPS, WIPO Patentscope, JPO, CNIPA, or an internal portfolio DB | must expose title, abstract, claims, applicant, inventors, filing date, classifications, drawings |
| LLM | any chat/completions provider with streaming and a long output budget | one model for summaries, a cheap one for keyword/glossary extraction |
| Persistence | any SQL/KV store with a TTL notion | tables/keys: patent cache, summary cache, score lock, search events |
| PDF | server-side renderer (headless browser to PDF) or client-side vector PDF lib | must embed a font covering the target script |

## Source adapter

Only `search-patents` and `fetch-patent` touch the office API. Isolate them behind one
adapter module exposing:

```
searchPatents(query, { field: "title"|"abstract"|"inventor", count }) -> RawHit[]
getPatent(number) -> RawPatent
```

Normalize into the shared shape before anything downstream sees it:

```
{ number, title, abstract, claims[], applicant, inventors[], filingDate,
  registerDate?, status, classifications[], drawings[] }
```

Field notes when swapping offices:
- Applicant strings are messy everywhere (`"대한민국(농촌진흥청장)"`, `"The United States
  of America, as represented by…"`). Normalize: strip whitespace, brackets, legal-form
  suffixes; match with `includes` on the normalized institution name.
- Status vocabularies differ. Map each office's terms onto
  `pending | granted | rejected | lapsed` and exclude the last two.
- Not all offices return drawings; make the drawing panel optional, not assumed.

## LLM adapter

Keep prompts in one module, provider calls in another. Requirements:
- Streaming for the summary endpoint; buffered calls hit request timeouts.
- Generous max output tokens — truncated summaries are the most common failure.
- Retry on transient errors with backoff (e.g. 1.5s, 4s), and treat an empty stream as
  a failure rather than an empty summary.
- Rate-limit and credit-exhaustion errors must reach the UI verbatim enough to act on.

## Image and link safety

Drawings and external assets must be proxied or allowlisted (SSRF protection): validate
the host against the office's domains, disallow redirects to private ranges, cap size.

## Access control

If the store enforces row-level security, every table needs explicit policies and grants
for the roles the app uses; caches read by anonymous visitors need a read policy, write
paths should stay server-only. Admin surfaces authenticate against hashed credentials or
a role table — never client-side flags.
