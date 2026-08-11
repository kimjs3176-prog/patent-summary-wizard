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
- **MCP 서버**: ChatGPT, Claude 등 외부 AI 클라이언트가 특허 검색·요약·분석 도구를 호출할 수 있도록 MCP 서버를 제공합니다.
- **관리자 페이지**: 캐시 관리, 통계 조회, 공지사항 관리, 만족도 조사 결과 확인 등의 관리 기능을 제공합니다.

## 기술 스택

- **프론트엔드**: Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **백엔드**: Lovable Cloud (Supabase Edge Functions)
- **AI**: Lovable AI Gateway (Gemini 모델)
- **데이터**: KIPRIS API, 국가법령정보 API
- **MCP**: `@lovable.dev/mcp-js`

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

## MCP 서버 연결 방법

이 서비스는 MCP(Model Context Protocol) 서버를 제공하여 ChatGPT, Claude, Cursor 등 외부 AI 클라이언트에서 특허 검색·요약·분석 도구를 사용할 수 있습니다. 아래 단계를 따라 연결할 수 있습니다.

### 1단계. MCP 서버 정보 확인

다음 정보를 확인합니다. 외부 AI 클라이언트에서 서버 등록 시 필요합니다.

| 항목 | 값 |
|---|---|
| 서버 이름 | AI 기술분석 서비스 |
| 슬러그 | `ai-gisulbunseog` |
| MCP 엔드포인트 | `https://rrvraugvigylkdpstwsl.supabase.co/functions/v1/mcp` |
| OAuth 발급자 | `https://rrvraugvigylkdpstwsl.supabase.co/auth/v1` |
| 동의 페이지 | `https://atipsum.lovable.app/.lovable/oauth/consent` |

### 2단계. 외부 AI 클라이언트에서 MCP 서버 추가

AI 클라이언트의 설정 또는 MCP 서버 추가 메뉴를 열고, **OAuth 기반 서버 추가**를 선택합니다.

- **엔드포인트**: `https://rrvraugvigylkdpstwsl.supabase.co/functions/v1/mcp` 를 입력합니다.
- **OAuth 발급자**: `https://rrvraugvigylkdpstwsl.supabase.co/auth/v1` 를 입력합니다.
- AI 클라이언트가 자동으로 서버를 조회하고 도구 목록을 불러옵니다.

### 3단계. 서비스 계정으로 로그인 및 동의

1. AI 클라이언트가 브라우저를 열어 인증을 요청하면, 서비스 계정(이메일/비밀번호 또는 Google)으로 로그인합니다.
2. 로그인 후 `https://atipsum.lovable.app/.lovable/oauth/consent` 화면에서 AI 클라이언트의 연결 요청을 확인합니다.
3. **연결 승인**을 클릭하면 AI 클라이언트에 안전한 OAuth 토큰이 발급됩니다.

> ⚠️ 동의 화면에서 로그인이 필요한 경우, 로그인 후 반드시 동의 페이지로 다시 돌아와 승인 버튼을 눌러야 합니다. 그래야 AI 클라이언트가 토큰을 정상적으로 수신합니다.

### 4단계. 연결 확인

AI 클라이언트에서 다음과 같은 도구가 추가되었는지 확인합니다.

- `search_patents` — 키워드·발명자·특허번호로 농식품 특허 검색
- `fetch_patent` — 특허 상세 정보 조회
- `summarize_patent` — AI 요약 및 본문 기반 키워드 추출
- `analyze_commercialization` — 사업화 분석(기술성·시장성·사업성) 점수 조회
- `analyze_regulations` — 국가법령정보 기반 규제 분석
- `recommend_patents` — 유사 특허 추천

### 5단계. 사용 예시

AI 클라이언트에게 다음과 같이 요청할 수 있습니다.

```
농식품 분야에서 '발효' 키워드로 특허를 검색해줘.
10-2019-0123456 특허의 사업화 분석 점수를 알려줘.
무알콜 맥주 관련 특허 3개를 추천해줘.
```

### 도구별 요청/응답 예시

#### `search_patents` — 특허 검색

- 입력 예시
  ```json
  {
    "query": "발효",
    "count": 5,
    "source": "all"
  }
  ```
- 테스트 프롬프트
  ```
  농식품 분야에서 '발효' 키워드로 특허 5개를 검색해줘.
  발명자 '김철수'가 출원한 특허를 찾아줘.
  특허번호 10-2017-0149000의 기본 정보를 알려줘.
  ```
- 응답 예시
  ```json
  {
    "total": 5,
    "patents": [
      {
        "patentNumber": "10-2017-0149000",
        "title": "발효된 콩 추출물을 이용한 식품 조성물",
        "applicant": "농촌진흥청",
        "relevanceScore": 0.92
      }
    ]
  }
  ```

#### `fetch_patent` — 특허 상세 조회

- 입력 예시
  ```json
  { "patent_number": "10-2017-0149000" }
  ```
- 테스트 프롬프트
  ```
  10-2017-0149000 특허의 상세 정보를 보여줘.
  10-2020-0051234의 출원인, 발명자, 청구항을 알려줘.
  ```
- 응답 예시
  ```json
  {
    "patentNumber": "10-2017-0149000",
    "patent": {
      "titleKo": "발효된 콩 추출물을 이용한 식품 조성물",
      "applicant": "농촌진흥청",
      "inventors": ["홍길동", "김철수"],
      "abstract": "...",
      "claims": ["..."],
      "representativeDrawing": "https://..."
    }
  }
  ```

#### `summarize_patent` — AI 요약

- 입력 예시
  ```json
  { "patent_number": "10-2017-0149000" }
  ```
- 테스트 프롬프트
  ```
  10-2017-0149000 특허를 일반인도 이해할 수 있게 요약해줘.
  이 특허의 핵심 기술과 기대 효과를 간단히 설명해줘.
  ```
- 응답 예시
  ```
  본 특허는 콩 발효 추출물을 활용하여 기능성을 높인 식품 조성물에 관한 것입니다. 
  기존 콩 가공물의 소화 흡수율 저하 문제를 해결하기 위해, 발효 공정을 적용해 
  영양성분의 생체 이용률을 개선한 점이 특징입니다. 기대 효과는 소화 개선 및 
  기능성 식품 소재로의 활용 가능성입니다.
  ```

#### `analyze_commercialization` — 사업화 분석

- 입력 예시
  ```json
  { "patent_number": "10-2017-0149000" }
  ```
- 테스트 프롬프트
  ```
  10-2017-0149000 특허의 사업화 가능성을 평가해줘.
  기술성, 시장성, 사업성 점수와 등급을 알려줘.
  ```
- 응답 예시
  ```json
  {
    "patentNumber": "10-2017-0149000",
    "analysis": {
      "totalScore": 78,
      "grade": "A",
      "technologyScore": 80,
      "marketScore": 75,
      "businessScore": 79,
      "recommendations": [
        "기능성 식품 시장 진출을 우선 검토",
        "제휴 제조사와의 공동 기술 이전 추진"
      ]
    }
  }
  ```

#### `recommend_similar_patents` — 유사 특허 추천

- 입력 예시
  ```json
  {
    "patent_number": "10-2017-0149000",
    "count": 5
  }
  ```
- 테스트 프롬프트
  ```
  10-2017-0149000과 유사한 특허 5개를 추천해줘.
  이 특허와 기술적으로 비슷한 농식품 특허가 뭐가 있어?
  ```
- 응답 예시
  ```json
  {
    "patentNumber": "10-2017-0149000",
    "recommendations": [
      {
        "patentNumber": "10-2018-0098765",
        "title": "발효 대두 단백질을 이용한 건강기능식품",
        "matchReason": "유사한 발효 공정 및 콩/대두 원료 사용",
        "overlapKeywords": ["발효", "콩", "단백질", "식품"]
      }
    ]
  }
  ```

#### `analyze_regulations` — 규제 분석

- 입력 예시
  ```json
  {
    "patent_number": "10-2017-0149000",
    "tech_field": "functional food"
  }
  ```
- 테스트 프롬프트
  ```
  10-2017-0149000 특허 기술을 사업화할 때 관련 법규를 알려줘.
  기능성 식품으로 출시할 때 적용되는 규제를 분석해줘.
  ```
- 응답 예시
  ```json
  {
    "patentNumber": "10-2017-0149000",
    "regulations": [
      {
        "title": "건강기능식품에 관한 법률",
        "reason": "기능성 표시 및 안전성 검토 필요"
      },
      {
        "title": "식품위생법",
        "reason": "식품 제조·가공 시설 및 유통 기준 적용"
      }
    ]
  }
  ```

### 연결 해제

외부 AI 클라이언트의 MCP 서버 목록에서 `AI 기술분석 서비스`를 삭제하면 연결이 해제됩니다. 서버 측 토큰은 자동으로 더 이상 사용되지 않습니다.

## 연락 및 지원

- Lovable 문서: https://docs.lovable.dev
- 커스텀 도메인 설정: https://docs.lovable.dev/features/custom-domain#custom-domain
