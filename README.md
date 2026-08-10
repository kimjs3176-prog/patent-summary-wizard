# 농식품분야 특허 AI 기술분석 서비스

한국 농식품 분야 특허를 AI가 자동으로 분석·요약하고 사업화 가능성을 평가하는 웹 서비스입니다.

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
- **MCP 서버**: ChatGPT, Claude 등 외부 AI 클라이언트가 특헀 검색·요약·분석 도구를 호출할 수 있도록 MCP 서버를 제공합니다.
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

## MCP 서버 연결

퍼블리시 후 외부 AI 클라이언트에서 다음 MCP 서버 정보를 사용할 수 있습니다.

- **서버명**: AI 기술분석 서비스
- **슬러그**: `ai-gisulbunseog`
- **OAuth 발급자**: `https://rrvraugvigylkdpstwsl.supabase.co/auth/v1`
- **동의 페이지**: `https://atipsum.lovable.app/.lovable/oauth/consent`
- **MCP 엔드포인트**: `https://rrvraugvigylkdpstwsl.supabase.co/functions/v1/mcp`

## 연락 및 지원

- Lovable 문서: https://docs.lovable.dev
- 커스텀 도메인 설정: https://docs.lovable.dev/features/custom-domain#custom-domain
