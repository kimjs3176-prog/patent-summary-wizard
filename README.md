# 농식품분야 특허 AI 기술분석 서비스

한국 농식품 분야 특허를 AI가 자동으로 분석·요약하고 사업화 가능성을 평가하는 웹 서비스입니다.

> 본 문서는 한국어로 작성되었습니다.

## 프로젝트 정보

- **Lovable 프로젝트**: https://lovable.dev/projects/5d67c532-7ab7-4cb4-9934-6cf82c86f25d
- **프리뷰 URL**: https://id-preview--5d67c532-7ab7-4cb4-9934-6cf82c86f25d.lovable.app
- **퍼블리시 URL**: https://atipsum.lovable.app

## 주요 기능

- **KIPRIS 특허 검색**: 키워드, 발명자 이름, 특허번호로 농식품 분야 특허를 검색합니다.
- **AI 요약**: 특허 명세서를 분석해 일반 사용자도 이해하기 쉬운 서술형 요약을 생성합니다.
- **사업화 분석**: 기술성·시장성·사업성을 평가하고 점수와 등급, 전략 제안을 제공합니다.
- **규제 분석**: 국가법령정보 API를 활용해 기술 사업화 시 예상되는 규제를 안내합니다.
- **유사 특허 추천**: 검색한 특허와 의미상 유사한 농식품 특허를 추천합니다.
- **도면 뷰어**: 대표 도면을 포함한 첨부 도면을 클릭해 확대·축소·드래그로 확인합니다.
- **관리자 페이지**: 캐시 관리, 통계 조회, 공지사항 관리, 만족도 조사 결과 확인 등의 관리 기능을 제공합니다.
- **출원지원 (옵션)**: 아이디어 → 선행기술 조사 → 진단·보완 → 서류 작성 → 제출·관리·해외 출원 5단계를 `/filing` 메뉴에서 AIS 의 한 기능으로 엽니다. 본문은 이 저장소 안의 사본 `public/filing-app/index.html`(같은 사이트 `/filing-app/`)을 iframe 으로 넣고, 단계 탭·쪽 이동·도움말은 AIS 가 그립니다. API 는 Edge Function `filing-api`(KIPRIS 탐색·명세서 초안·AI·수출 실적·지원사업·기사·동향)입니다. 관리자 페이지 ‘기능 활성화’의 **출원지원** 토글로 켜고 끄며(기본 켜짐), ‘출원지원 주소’를 비우면 사이트 안의 사본, https 주소를 넣으면 바깥 서버를 씁니다.
  - 사본 갱신: 원본은 에이프 저장소(kimjs3176-prog/koat-axlab)입니다. 그쪽을 고친 뒤 `node scripts/sync-filing-app.mjs ../koat-axlab` 을 돌리면 `public/filing-app/index.html`(출원지원만 남긴 빌드, 3D 섬·기술분석·해외동향 없음)과 `supabase/functions/filing-api/lib/`(서버 모듈 사본)가 함께 바뀝니다. 직접 고치지 마세요.
  - Edge Function 비밀값: `KIPRIS_API_KEY`(기존과 공유), `DATA_GO_KR_SERVICE_KEY`(관세청 수출 실적·기업마당 지원사업 공고), 선택 `ANTHROPIC_API_KEY`(서버 AI; 없으면 화면에서 넣는 키로), `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`(기사, 없으면 구글 뉴스 RSS). 특허 요약의 **출원지원으로** 버튼은 그 특허를 비교 특허로, 검색 결과의 **이 키워드로 출원 준비** 버튼은 키워드로 새 시나리오를 시작합니다. 에이프 안의 ‘AIS로 분석’은 이 사이트의 요약·검색으로 돌아옵니다.

## 기술 스택

- **프론트엔드**: Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **백엔드**: Lovable Cloud (Supabase Edge Functions)
- **AI**: Lovable AI Gateway (Gemini 모델)
- **데이터**: KIPRIS API, 국가법령정보 API

## 로컬 개발 방법

프로젝트를 로컬에서 실행하려면 아래 단계를 따라 주세요.

```sh
# 1. 저장소를 클론합니다.
git clone <YOUR_GIT_URL>

# 2. 프로젝트 디렉터리로 이동합니다.
cd <YOUR_PROJECT_NAME>

# 3. 의존성을 설치합니다.
npm i

# 4. 개발 서버를 실행합니다.
npm run dev
```

> Lovable 편집기에서 수정한 내용은 저장소에 자동으로 반영되며, GitHub에서 직접 푸시한 변경 사항도 Lovable에 동기화됩니다.

## 배포 방법

1. [Lovable 프로젝트](https://lovable.dev/projects/5d67c532-7ab7-4cb4-9934-6cf82c86f25d)로 이동합니다.
2. 우측 상단의 **Share → Publish**를 클릭해 배포를 진행합니다.

## 연락 및 지원

- Lovable 문서: https://docs.lovable.dev
- 커스텀 도메인 설정: https://docs.lovable.dev/features/custom-domain#custom-domain
