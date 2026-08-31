---
name: patent-ai-summary-platform
description: Build or adapt an AI patent analysis & summary service (KIPRIS search, AI 요약서, 사업화 점수, 규제 분석, PDF/MCP 출력) for any institution or technology field — use when porting the AIS/Agri IP Summary architecture to a new organization, changing the applicant scope, or adding a new domain vertical.
---

# Patent AI Summary Platform (범용 이식 스킬)

This skill generalizes the Agri IP Summary (AIS) architecture so a different institution
(보건·에너지·해양·국방·지자체 등) can run the same pipeline over its own patent portfolio
and technology field.

## What the platform is

```text
사용자 입력(특허번호 / 키워드 / 발명자 / 일괄목록)
        │
        ├─ search-patents      KIPRIS 검색 + 기관 필터 + IDF 랭킹
        ├─ fetch-patent        서지·청구항·초록·대표도면 (7일 캐시)
        ├─ summarize-patent    LLM 스트리밍 요약서 (SSE)
        ├─ analyze-commercialization  기술성/시장성/사업성 점수 + TRL
        ├─ analyze-regulations 국가법령정보 API 규제 매칭
        └─ recommend-similar-patents
        │
   TossPatentSummary (웹) → PdfGenerator (PDF) → MCP tools (에이전트)
```

Every piece is domain-agnostic **except four things**: the applicant whitelist, the
domain keyword dictionary, the scoring rubric, and the branding. Porting = changing
those four, nothing else.

## Porting checklist (in order)

1. **기관 스코프** — replace the applicant filter list. See
   `references/domain-config.md`. Never leave the original 6개 농업기관 list in place;
   an unfiltered service returns the whole KIPRIS corpus and every downstream score
   becomes meaningless.
2. **도메인 사전** — swap keyword categories (소재/공정/용도/효과 in agri) for the new
   field's categories, and rewrite the false-positive guards.
3. **평가 루브릭** — retune `analyze-commercialization` prompt axes and score bands to
   the new field's commercialization reality (see `references/scoring.md`).
4. **규제 매핑** — change the law-domain hints passed to 국가법령정보 검색.
5. **브랜딩** — service name, subtitle, color token, index.html metadata, MCP server
   name/title in `src/lib/mcp/index.ts`.
6. **재배포** — deploy edge functions, regenerate MCP manifest, publish.

## Hard rules learned the hard way

- **Applicant filter is applied server-side**, inside the edge function, not in the UI.
  Client-side filtering leaks out-of-scope patents into caches and MCP responses.
- **No fabricated summaries.** If KIPRIS returns no usable title/abstract/claims, abort
  before calling the LLM and show an error. See `usePatentSummary.ts` `hasUsable`.
- **Score lock.** Cache the commercialization score keyed by patent number. Regenerating
  per search makes the same patent score differently on two screens and destroys trust.
- **Cache everything upstream** (7-day TTL on KIPRIS payloads). Public patent APIs are
  rate-limited and slow; batch mode must run with concurrency 1 plus inter-request delay.
- **Korean text in PDF** must use the embedded Noto font; ASCII-only strings may use the
  mono face. Mixing breaks glyphs silently.
- **Do not regex-correct Korean 조사.** It corrupts words. Enforce grammar in the prompt.
- Keyword extraction reads the **summary body**, then validates each keyword against the
  patent title/abstract; discard keywords that appear only once and are unrelated.

## References

| Need | Read |
| --- | --- |
| Config surface to change per institution | `references/domain-config.md` |
| Edge function contracts and prompts | `references/pipeline.md` |
| Scoring/TRL rubric design | `references/scoring.md` |
| Exposing the service as MCP tools | `references/mcp.md` |

## Verification before declaring a port done

- 3 in-scope patent numbers → 요약서 renders, score present, no empty sections.
- 1 out-of-scope patent (other institution) → rejected or clearly marked.
- 1 keyword search + 1 inventor-name search → ranked, no 거절/소멸 patents.
- PDF download → Korean renders, page headers/folios correct.
- MCP `search_patents` + `summarize_patent` over the deployed URL → 200 with content.
