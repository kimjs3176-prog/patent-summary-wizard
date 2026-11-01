# 농식품분야 특허 AI 기술분석 서비스

한국 농식품 분야 특허를 AI가 자동으로 분석·요약하고 사업화 가능성을 평가하는 웹 서비스입니다.

> 본 문서는 한국어로 작성되었습니다.

## 프로젝트 정보
- **퍼블리시 URL**: https://atipsum.lovable.app

## 주요 기능

- **KIPRIS 특허 검색**: 키워드, 발명자 이름, 특허번호로 농식품 분야 특허를 검색합니다.
- **AI 요약**: 특허 명세서를 분석해 일반 사용자도 이해하기 쉬운 서술형 요약을 생성합니다.
- **사업화 분석**: 기술성·시장성·사업성을 평가하고 점수와 등급, 전략 제안을 제공합니다.
- **규제 분석**: 국가법령정보 API를 활용해 기술 사업화 시 예상되는 규제를 안내합니다.
- **유사 특허 추천**: 검색한 특허와 의미상 유사한 농식품 특허를 추천합니다.
- **도면 뷰어**: 대표 도면을 포함한 첨부 도면을 클릭해 확대·축소·드래그로 확인합니다.
- **관리자 페이지**: 캐시 관리, 통계 조회, 공지사항 관리, 만족도 조사 결과 확인 등의 관리 기능을 제공합니다.
- **출원지원 (옵션)**: 아이디어 → 선행기술 조사 → 진단·보완 → 서류 작성 → 제출·관리·해외 출원 5단계를 `/filing` 메뉴에서 AIS 의 한 기능으로 엽니다. 본문은 이 저장소 안의 사본 `public/filing-app/index.html`(같은 사이트 `/filing-app/`)을 iframe 으로 넣고, 단계 탭·쪽 이동·도움말은 AIS 가 그립니다. API 는 Edge Function `filing-api`(KIPRIS 탐색·명세서 초안·AI·지침·동향)입니다. 관리자 페이지 ‘기능 활성화’의 **출원지원** 토글로 켜고 끄며(기본 켜짐), ‘출원지원 주소’를 비우면 사이트 안의 사본, https 주소를 넣으면 바깥 서버를 씁니다.
  - 수정 위치: 처음에는 에이프 저장소(kimjs3176-prog/koat-axlab)에서 가져왔지만 이제 동기화하지 않습니다. 출원도우미 수정은 이 저장소의 `public/filing-app/index.html`(화면)과 `supabase/functions/filing-api/lib/`(서버 모듈)에서 직접 합니다.
  - Edge Function 비밀값: `KIPRIS_API_KEY`(기존과 공유)만 필수. 서버 AI(명세서 초안·AI 분석)는 사이트의 다른 AI 기능과 같은 Lovable AI 게이트웨이(`LOVABLE_API_KEY`, Lovable Cloud 가 넣어 줌)를 쓰고, 모델은 선택 `FILING_AI_MODEL`(기본 `google/gemini-3.8-flash`)로 바꿀 수 있습니다. 사용자가 화면에 자기 Gemini·Claude 키를 넣으면 그 키를 먼저 씁니다. 수출 실적·지원사업 공고·기사 API 는 에이프 해외동향용이라 이 사본에는 없고, 5단계 해외 출원의 그 칸은 비어 있습니다(예시 지원사업 카드와 해외 출원 비용 지원 안내는 뺐고, 체크리스트·로드맵은 그대로). 특허 요약의 **출원지원으로** 버튼은 그 특허를 비교 특허로, 검색 결과의 **이 키워드로 출원 준비** 버튼은 키워드로 새 시나리오를 시작합니다. 에이프 안의 ‘AIS로 분석’은 이 사이트의 요약·검색으로 돌아옵니다.

## 기술 스택

- **프론트엔드**: Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **백엔드**: Lovable Cloud (Supabase Edge Functions)
- **AI**: Lovable AI Gateway (Gemini 모델)
- **데이터**: KIPRIS API, 국가법령정보 API

## 연락 및 지원

- Lovable 문서: https://docs.lovable.dev
- 커스텀 도메인 설정: https://docs.lovable.dev/features/custom-domain#custom-domain
