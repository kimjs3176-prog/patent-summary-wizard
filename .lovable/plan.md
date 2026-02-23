

## 상세/요약 전환 시 분석 내용 불일치 버그 수정

### 문제 원인

`usePatentSummary.ts`의 `generateSummary` 함수에서 `analysisMode` 기본값이 `"summary"`로 설정되어 있습니다. 하지만 `Index.tsx`에서는 `analysisMode` 상태를 `"detailed"`로 초기화합니다.

결과적으로:
- 첫 검색 시 UI는 "상세" 모드로 표시되지만, 실제 API에는 `"summary"` 모드로 요청
- 캐시에도 `"summary"` 키로 저장되어 모드 전환 시 혼동 발생

### 수정 사항

**1. `src/hooks/usePatentSummary.ts` - 기본 분석 모드를 `"detailed"`로 변경**

- 13행: `generateSummary` 함수의 `analysisMode` 기본값을 `"summary"` -> `"detailed"`로 수정

**2. `src/pages/Index.tsx` - 초기 검색 시 현재 모드 전달**

- `handleSubmitInternal`에서 `generateSummary` 호출 시 현재 `analysisMode` 상태값을 명시적으로 전달하도록 수정
- "새로운 검색" 시 `analysisMode`를 `"detailed"`로 초기화

### 기술 상세

```text
[현재 흐름 - 버그]
Index.tsx: analysisMode = "detailed" (UI 표시)
    -> generateSummary(patentNumber)  // mode 미전달
        -> usePatentSummary: default = "summary"  // 실제 요청
            -> Edge Function: analysisMode = "summary"

[수정 후 흐름]
Index.tsx: analysisMode = "detailed" (UI 표시)
    -> generateSummary(patentNumber, "detailed")  // 명시적 전달
        -> Edge Function: analysisMode = "detailed"
```

