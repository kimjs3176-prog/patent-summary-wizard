# Architecture rules

Subdirectories have their own AGENTS.md (src/, supabase/functions/); read it before changing files there.

- Keep technology classification in the shared primary-IPC classifier and version the statistics cache whenever mappings change, so frontend labels and server counts stay consistent.
- Every service is named, described and grouped once in src/lib/services.ts; the shared header menu (SiteNav in PageLayout) and home 서비스 바로가기 cards read from it, so pages never add their own 홈으로/service buttons (headerRight is for page-specific actions only).
- Delete server functions and UI modules once no screen calls them (verify by searching src), so unused public endpoints never stay deployed.
- Toolchain is Vite 6, Vitest 4 and React Router 7 (via react-router-dom) to stay clear of known advisories; keep tsconfig lib at ES2020-safe APIs.
- Secret-scan exceptions live in .gitleaks.toml as narrow patterns for verified public values only; keep bun.lock and package-lock.json on the same patched versions (regenerate package-lock.json with npm 11; npm 10 crashes on this tree).
- The service collects no personal information: no identity/contact forms and no server-side visitor records beyond aggregate counts. 기술이전 신청 links out to NATI.

## Lovable ↔ Claude co-editing
- Lovable commits straight to main; Claude works on its own branch from the latest origin/main, opens small PRs, and merges only when the owner asks.
- Do not hand-edit Lovable-owned files: src/integrations/supabase/types.ts and client.ts, the committed .env, .lovable/. Schema changes go in a new supabase/migrations file (never edit an applied one).
- GitHub changes go live only after Publish (src/, public/) and a deploy request in the Lovable chat for changed functions and new migrations. `node scripts/lovable-deploy-list.mjs <base> [head]` lists them (a function counts as changed when its files or any imported _shared module changed); CI writes the same list ("Lovable 배포 목록") and every PR body states it or says Publish alone is enough.
- Prefer changes that need no function deploy: copy, layout, public/filing-app and admin-stored site settings ship without one.
