# Architecture rules

- Homepage technology tiles use a D3 treemap sized by deduplicated KIPRIS application counts, classified by primary IPC; this preserves proportional area without double-counting multi-class patents.
- Technology filing statistics are computed server-side for all six applicant groups over a rolling three-year window and cached daily as a complete site_settings snapshot; incomplete API responses never replace valid counts.
- Keep technology classification in the shared primary-IPC classifier and version the statistics cache whenever mappings change; this keeps frontend labels and server counts consistent without serving obsolete merged categories.

- Normalize commercialization prose through the shared summary presentation helper before parsing web or print output, so cached and newly generated summaries follow the same formatting rules.- Domestic market figures registered in the KOSIS series list (summarize-patent/kosis.ts) take their base value and CAGR from official statistics (refreshed every 30 days) and override AI-written numbers, so the same market always shows the same official figures.
- Market figures are pinned per market in market_reference (domestic KRW and global USD alike); stored values are injected into the summary prompt and re-applied after generation, so the AI reuses existing markets instead of inventing new numbers.
