# Patent AI Summary Platform — 범용 스킬

기관 보유 특허를 AI로 **검색 · 요약 · 사업화 평가 · 규제분석**하고
**웹 / PDF / MCP** 로 제공하는 서비스 설계를, 어떤 기관·분야·기술스택에도
이식할 수 있도록 일반화한 스킬입니다.

특정 프레임워크·런타임·DB·특허청 API·LLM 벤더에 종속되지 않습니다.
스택별 결합 방법은 `references/stack-adapters.md` 에 분리되어 있습니다.
(레퍼런스 구현: 농업분야 Agri IP Summary — React + 서버리스 함수 + Gemini + KIPRIS)

---

## 1. 사용법

### 자동 적용
"○○원 보유 특허로 AI 요약 서비스 만들어줘", "출원인 범위를 바꿔줘",
"USPTO 기준으로 포팅해줘" 같은 요청에 자동 참조됩니다.

### 직접 호출
채팅 입력창에 `/` 입력, 또는 왼쪽 하단 **+ 버튼 > Add skill**.

### 프롬프트 예시
```
/patent-ai-summary-platform
한국해양과학기술원 보유 특허 대상 서비스를 구성해줘.
키워드 카테고리는 소재/공법/해역/효과, 규제는 해양환경관리법 계열,
특허 소스는 KIPRIS, 백엔드는 Node 서버로.
```

---

## 2. 이식 시 바꾸는 것은 5가지뿐

| # | 변수 | 참고 문서 |
| --- | --- | --- |
| 1 | 기관 스코프(출원인 화이트리스트) | `references/domain-config.md` |
| 2 | 도메인 키워드 사전 + 오탐 가드 | `references/domain-config.md` |
| 3 | 사업화 평가 루브릭 · 가중치 · 점수대 · TRL 근거 규칙 | `references/scoring.md` |
| 4 | 규제(법령) 도메인 및 법령검색 API | `references/pipeline.md` |
| 5 | 브랜딩(서비스명·부제·메타·팔레트·MCP 정체성) | `references/mcp.md` |

나머지(파이프라인·요약 프롬프트 구조·PDF 조판·MCP 래퍼)는 그대로 재사용합니다.
스택 선택(특허 소스 API · LLM · 저장소 · 런타임 · PDF 렌더러)은
`references/stack-adapters.md` 를 따릅니다.

---

## 3. 주요 기능

| 기능 | 설명 |
| --- | --- |
| 특허 검색 | 키워드 / 발명자명 / 특허번호, IDF 랭킹, 거절·소멸 건 제외 |
| AI 요약서 | 핵심기술·해결문제·해결수단·정량효과·활용분야·시장동향 스트리밍 생성 |
| 사업화 점수 | 기술성·시장성·사업성 3축 + TRL 9단계, 특허번호 기준 점수 고정 |
| 규제 분석 | 관할 법령검색 API 연동, 사업화 시 예상 규제 매칭 |
| 유사특허 추천 | 의미 기반 유사 특허 + 매칭 사유 |
| PDF 다운로드 | 러닝헤드·폴리오·북마크를 갖춘 편집 조판형 요약서 |
| 일괄조회 | 다건 동시 입력, 좌측 목록 / 우측 요약서 분할 뷰 |
| MCP 서버 | 도구 세트를 외부 AI 에이전트에 제공 |

---

## 4. 화면 이미지 (레퍼런스 구현)

### 메인 (검색 · 주제별 탐색 · 인기검색어)
![메인 화면](assets/screen-home.png)

### 일괄조회 (분할 뷰)
![일괄조회 화면](assets/screen-batch.png)

---

## 5. 시스템 구조

```text
사용자 입력(특허번호 / 키워드 / 발명자 / 일괄목록)
        │
        ├─ search-patents              특허 검색 + 기관 필터 + IDF 랭킹
        ├─ fetch-patent                서지·청구항·초록·도면 (7일 캐시)
        ├─ summarize-patent            LLM 스트리밍 요약서
        ├─ analyze-commercialization   3축 점수 + TRL (점수 락)
        ├─ analyze-regulations         법령 규제 매칭
        └─ recommend-similar-patents   유사특허 추천
        │
   웹 요약서  →  PDF 리포트  →  MCP 도구(외부 에이전트)
```

각 항목은 JSON 계약이 고정된 서버 엔드포인트 하나입니다. 런타임은 자유롭게 교체하되
계약(`references/pipeline.md`)은 유지합니다.

---

## 6. 폴더 구성

```
patent-ai-summary-platform/
├── SKILL.md                      # 이식 체크리스트 + 필수 규칙
├── README.md                     # 이 문서
├── assets/                       # 레퍼런스 구현 화면 이미지
└── references/
    ├── domain-config.md          # 기관·분야별 설정 표면
    ├── pipeline.md               # 엔드포인트 계약 및 프롬프트 규칙
    ├── scoring.md                # 점수·TRL 루브릭 설계
    ├── mcp.md                    # MCP 도구 노출 방법
    └── stack-adapters.md         # 런타임·특허청 API·LLM·PDF 결합 방법
```

---

## 7. 이식 시 반드시 지킬 것

- 출원인 필터는 **서버에서** 적용 — 검색·번호조회·추천 **모든 경로**
- 원문 확보 실패 시 LLM 호출 금지 (가짜 요약 방지)
- 사업화 점수는 특허번호 기준 캐시로 고정
- 상용 API 부하 방지: 업스트림 7일 캐시 + 일괄조회 동시성 1
- 비라틴 문자 PDF는 텍스트 런 단위로 내장 폰트 적용
- 문법(조사·어미) 정규식 자동교정 금지 — 프롬프트 규칙으로 처리
- 강조는 완전한 명사구 단위로만
