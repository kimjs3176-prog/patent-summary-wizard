# Agri IP Summary (AIS) · 농식품 특허 AI 기술분석 서비스

농업 국가연구기관의 국유특허를 AI가 원문 근거로 읽고, 누구나 이해할 수 있는 A4 2쪽 요약서로 정리해 기술이전과 사업화를 돕는 웹 서비스입니다. 특허를 처음 내 보는 사람을 위한 출원도우미도 함께 제공합니다.

- **접속 주소**: https://atipsum.lovable.app (설치·회원가입·로그인 없음, PC와 휴대폰 브라우저)
- **운영**: 한국농업기술진흥원
- **개인정보**: 받지 않습니다. 방문과 검색은 횟수만 셉니다.

## 빠른 시작

### 방법 A. 운영 주소에서 바로 쓰기 (권장)

1. 브라우저에서 https://atipsum.lovable.app 을 엽니다.
2. 첫 화면 검색창에 특허번호 `10-2080834`를 넣습니다. 요약서가 열립니다(처음 만들 때는 수십 초, 그 뒤로는 저장본이 바로 뜹니다).
3. 요약서에서 사업화 점수, 시장 표의 '공식 통계 / AI 추정' 표시, 예상 규제의 법령 링크를 확인하고 'PDF 다운로드'나 인쇄로 A4 2쪽을 받습니다.
4. 검색창에 문장(예: `토마토 생육을 촉진하는 미생물 비료`)이나 질문을 넣으면 조건에 맞는 특허 목록과 대화형 특허 상담이 나옵니다.
5. 상단 메뉴 '출원도우미'에서 안내 팝업을 확인한 뒤 '어떤 기술을 만들고 싶나요?'에 평소 말로 답하면 5단계가 이어집니다.

### 방법 B. 소스 코드로 실행하기

Node.js 22 이상과 npm 11 이상이 필요합니다(`package.json`의 `engines`, `.nvmrc`).

```bash
npm ci
```

```bash
npm run dev
```

브라우저에서 http://localhost:8080 을 엽니다. 화면은 저장소에 들어 있는 공개 설정(`.env`의 공개 키)으로 운영 중인 서버 함수에 연결되므로 API 키를 따로 넣을 필요가 없습니다.

## 구조

```text
┌──────────────────────┐  HTTPS  ┌───────────────────────────┐       ┌────────────────────────┐
│ 브라우저              │────────▶│ Supabase Edge Functions   │──────▶│ KIPRIS (특허 원문)      │
│ React 화면 (src/)     │         │ (Deno, supabase/functions)│──────▶│ KOSIS (국가통계)        │
│ 출원도우미             │         │                           │──────▶│ 국가법령정보 (법령)      │
│ (public/filing-app)  │         │ 저장: Supabase Postgres    │──────▶│ AI 게이트웨이 (LLM)     │
└──────────────────────┘         └───────────────────────────┘       └────────────────────────┘
```

- **화면**: Vite 6, React 18, TypeScript, Tailwind CSS, shadcn/ui, React Router 7 (`src/`)
- **출원도우미**: 한 파일로 된 화면 `public/filing-app/index.html`을 `/filing` 페이지가 iframe으로 넣고, 서버는 `supabase/functions/filing-api/`입니다.
- **서버**: Supabase Edge Functions(Deno). 현재 Lovable Cloud(Supabase 기반)에서 운영합니다.
- **데이터**: KIPRIS(특허), KOSIS(국가통계), 국가법령정보(법령) 공개 API. 요약서와 조회 결과는 Supabase Postgres에 저장해 다시 씁니다.

## 주요 기능

메뉴 이름과 설명은 `src/lib/services.ts` 한 곳에서 관리합니다.

| 메뉴 | 주소 | 하는 일 |
| --- | --- | --- |
| 통합검색 (홈) | `/` | 키워드, 문장, 질문을 검색창 하나로 받습니다. 특허번호는 요약서로, 짧은 단어는 넓은 검색으로, 설명형 문장은 조건에 맞는 특허만 골라 보여 주고, 질문은 그 자리에서 대화형 특허 상담으로 답합니다. |
| AI 특허 요약서 | `/?patent=번호` | 특허번호 하나로 A4 2쪽 요약서를 만듭니다(아래 '요약서' 참고). |
| 나만의 특허찾기 | `/finder` | 업종과 아이템을 넣으면 검색된 후보 안에서 맞는 특허를 골라 추천합니다. |
| 무상기술이전 | `/potential` | 무상으로 이전받을 수 있는 특허 목록을 모아 보여 줍니다. |
| 식품기술이전 협의체 | `/consortium` | 협의체 51개 기관(대학 산학협력단·연구기관·기술지주회사)을 골라 그 기관이 가진 특허를 봅니다. 기관마다 출원인명으로 특허고객번호를 찾아 그 번호로만 목록을 받으므로 이름이 비슷한 다른 기관의 특허가 섞이지 않습니다. |
| 출원도우미 | `/filing` | 아이디어 정리 → 비슷한 특허 찾기 → 특허 가능성 진단 → 서류 만들기 → 제출하고 챙기기 5단계로 출원 준비를 돕고, 제출용 묶음 파일(zip)과 변리사 상담 요약서(.docx)를 만듭니다. 자세한 동작은 [docs/filing-helper.md](docs/filing-helper.md)에 있습니다. |
| 인사이트 | `/insights` | 연도별·기술분야별 출원 동향과 주요 키워드를 보여 줍니다. |
| 일괄조회 | `/batch` | 여러 특허를 한 번에 조회하고 엑셀로 내려받습니다. |
| 관심특허 | `/compare` | 담아 둔 특허를 모아 나란히 비교합니다(브라우저에만 저장). |
| 기술소개영상 | `/tech-videos` | 농식품 주요 기술을 영상으로 소개합니다. |

기술이전 신청은 농업기술실용화 정보(NATI)로 바로 연결합니다. 이 사이트는 신청서나 연락처를 받지 않습니다.

### 요약서

- **머리**: 특허 명칭과 기본정보(출원·등록 번호와 일자, 발명기관, 관리기관, 발명자, 특허분류), 관련 키워드를 짙은 초록 띠에 모읍니다.
- **본문(1열)**: 사업화 점수·기술 성숙도(TRL) → 어떤 기술인가요? → 무엇을 해결하나요?(본문과 대표 도면 2열) → 어디에 쓸 수 있나요? → 시장은 어떻게 움직이나요?(시장 표) → 사업화 가능성은? → 예상 규제 → 기능이 비슷한 특허 → 종합 의견.
- **쉬운 말과 중요 문구 강조**: 비전문가가 읽을 수 있는 말로 쓰되 원문의 사실(성분, 균주, 수치, 청구 대상)은 바꾸지 않습니다. 볼드만 이어 읽어도 핵심이 보이도록 절마다 3~5곳을 형광 밑줄로 강조합니다.
- **인쇄·PDF**: 인쇄와 PDF 다운로드는 항상 A4 정확히 2쪽입니다. 휴대폰 브라우저의 인쇄도 요약서만 찍힙니다.
- **공유**: 링크 복사, 이메일, QR 코드로 보냅니다.

### 신뢰성 장치

- 기술 서술은 특허 원문(명칭·초록·청구항·설명)에 있는 내용만 쓰고, 원문에 없는 효과 수치는 생성 후 서버가 지웁니다.
- 시장 규모는 KOSIS 국가통계나 관리자가 검수한 값이면 '공식 통계', 출처를 확인하지 못한 값이면 'AI 추정'으로 표시하고, 같은 시장은 언제 봐도 같은 값이 나오도록 고정합니다.
- 예상 규제에는 법령 원문 링크와 "실제 적용은 소관부처 확인 필요" 안내를 붙입니다.
- 특허 상담과 특허찾기는 실제로 검색된 특허 안에서만 답하고 추천합니다.

### 관리자 페이지 (`/admin`)

- **콘텐츠**: 추천 특허, 공지사항
- **홈페이지**: 문구, 홈 섹션 보이기, 기술소개영상, 기능 켜고 끄기(출원도우미 등)와 출원도우미 주소
- **요약서**: 섹션 제목·분량, 프롬프트 보충, 사업화 점수·TRL 기준, 시장 표준값 검토(AI 추정 값 승인)
- **출력**: 인쇄 섹션, PDF 배치
- **시스템**: 요약서 캐시 관리, 인기 특허 요약서 미리 생성, 이용·방문 통계, 만족도 결과, 관리자 비밀번호

## AI 모델 연결과 교체

- 모든 AI 호출은 서버에서 OpenAI 호환 Chat Completions 방식의 게이트웨이(Lovable AI Gateway) 한 곳으로만 나갑니다. 화면은 AI를 직접 부르지 않습니다.
- 모델 이름은 `supabase/functions/_shared/aiConfig.ts` 한 곳에서 정합니다. 작업 무게에 따라 세 단계입니다.

| 단계 | 환경변수 | 기본 모델 | 쓰는 곳 |
| --- | --- | --- | --- |
| main | `AI_MODEL` | `google/gemini-3.8-flash` | 요약서, 사업화 점수, 특허 상담 답변, 출원도우미, 출원 동향 |
| lite | `AI_MODEL_LITE` | `google/gemini-3.1-flash-lite` | 검색어 정리, 용어 풀이, 규제 찾기 |
| alt | `AI_MODEL_ALT` | `openai/gpt-6-astra` | 대체 검색어 제안 |

- **모델 교체**: 위 환경변수(서버 비밀값)에 `제공사/모델명`을 넣으면 코드 수정 없이 바뀝니다. 형식이 틀리면 기본 모델을 씁니다.
- **게이트웨이 교체**: 요약서·점수·검색·출원도우미는 `aiConfig.ts`의 게이트웨이 주소와 키 이름만 바꾸면 됩니다. 특허 상담(`patent-chat`), 나만의 특허찾기(`find-my-patents`), 출원 동향(`filing-trends`)은 게이트웨이 연결 모듈(`@lovable.dev/ai-gateway`)을 쓰므로 그 모듈도 함께 바꿔야 합니다.
- **키**: `LOVABLE_API_KEY`, `KIPRIS_API_KEY`, `KOSIS_SERVICE_KEY` 등은 서버 비밀값으로만 두고 저장소에는 넣지 않습니다.

## 서버 함수

| Edge Function | 역할 |
| --- | --- |
| `search-patents` | 키워드·문장 검색, 문장형 검색의 관련도 판정 |
| `fetch-patent`, `patent-register`, `govt-patent`, `proxy-image` | 특허 원문·등록 정보·국유특허 정보·도면 가져오기 |
| `summarize-patent` | 요약서 생성(프롬프트 버전 관리, 볼드 규칙 `boldPolicy.ts`, 시장 수치 보정) |
| `analyze-commercialization`, `analyze-regulations`, `recommend-similar-patents`, `extract-glossary` | 점수·TRL, 예상 규제, 비슷한 특허, 용어 풀이 |
| `patent-chat`, `find-my-patents`, `suggest-keywords` | 특허 상담, 나만의 특허찾기, 대체 검색어 |
| `filing-api`, `filing-trends` | 출원도우미 서버, 출원 동향 통계 |
| `consortium-patents` | 식품기술이전 협의체 기관별 특허(출원인명 → 특허고객번호, 찾은 번호는 90일 저장) |
| `export-patents`, `manage-featured-patents`, `sync-r2-videos` | 엑셀 내보내기, 추천 특허 관리, 영상 목록 동기화 |

## 점검

```bash
npm test
```

```bash
npm run lint
```

화면 전체 점검은 빌드한 뒤 미리보기 서버를 띄우고 돌립니다. Playwright와 Chromium이 필요합니다(`npm i --no-save playwright@1.63.0`, `npx playwright install chromium`).

```bash
npm run build
```

```bash
npx vite preview --host 127.0.0.1 --port 4173 --strictPort
```

다른 터미널에서 실행합니다.

```bash
node scripts/smoke.mjs http://127.0.0.1:4173
```

`scripts/smoke.mjs`는 바깥 요청을 막은 상태에서 모든 화면을 PC·휴대폰 폭으로 열어 오류와 가로 넘침을 보고, 출원도우미 전체 흐름과 제출 묶음 파일, 요약서 인쇄·PDF가 정확히 A4 2쪽인지 확인합니다. 요약서는 저장해 둔 응답(`scripts/fixtures/summary-10-2080834.json`)으로 띄웁니다. GitHub Actions(`.github/workflows/ci.yml`)가 같은 점검과 타입 검사, Edge Function `deno check`, 비밀값 검사를 돌리고, 매일 보안 점검(`security-daily.yml`)이 따로 돕니다.

## 배포

- 화면(`src/`, `public/`) 변경은 Lovable에서 Publish해야 운영 주소에 반영됩니다.
- Edge Function과 새 마이그레이션(`supabase/migrations/`)은 Lovable 채팅에 배포를 요청합니다. `node scripts/lovable-deploy-list.mjs <기준> [대상]`이 배포할 함수를 알려 줍니다.
- 작업 규칙은 저장소 루트와 `src/`, `supabase/functions/`의 `AGENTS.md`에 있습니다.

## 알려진 제약

- 특허·통계·법령은 KIPRIS·KOSIS·국가법령정보 공개 API에 의존합니다. 해당 기관에 장애가 있으면 일부 항목이 늦게 나오거나 비어 있을 수 있습니다.
- 요약서를 처음 만들 때는 수십 초가 걸립니다. 한 번 만든 요약서는 저장되어 바로 뜹니다.
- 시장 규모는 대응하는 국가통계가 없으면 'AI 추정'으로 표시되는 참고값이고, 예상 규제는 소관부처 확인이 필요합니다.
- 출원도우미는 개발 중인 기능이며 결과물은 참고 자료입니다. 특허 출원이나 등록을 보장하지 않으므로 출원 전에 변리사 검토가 필요합니다.
- 다른 환경으로 옮기려면 Supabase 프로젝트(마이그레이션 적용, 함수 배포, 비밀값 등록)와 위 '게이트웨이 교체' 작업이 필요합니다.

## 오픈소스

React, Vite, Tailwind CSS, shadcn/ui, Supabase JS, jsPDF, html2canvas 등 MIT·ISC·Apache-2.0·BSD 계열의 허용형 라이선스 구성요소를 씁니다(전체 목록은 `package.json`). 외부 API 키는 저장소에 들어 있지 않습니다.

## 문서

- [docs/filing-helper.md](docs/filing-helper.md): 출원도우미 자세한 동작
- [docs/security-review-2026-11.md](docs/security-review-2026-11.md): 보안 점검 기록
