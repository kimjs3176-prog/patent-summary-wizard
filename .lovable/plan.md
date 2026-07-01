## 히어로 섹션 배경 애니메이션 강화

현재 히어로는 딥네이비 + 정적 그라데이션 글로우 + 그리드로 구성. 콘텐츠(헤드라인/검색바/트러스트)는 유지하고 **배경 레이어만** 은은한 빛 입자 드리프트 효과로 강화.

### 변경 파일
1. **`src/components/HeroParticles.tsx`** (신규)
   - 순수 CSS/JSX 파티클 컴포넌트. 랜덤 위치·크기·지연·duration으로 18~24개의 에메랄드 점을 절대배치.
   - 상하 부유(`drift`) + 부드러운 점멸(`twinkle`) 두 가지 keyframe 결합. `pointer-events-none`, `aria-hidden`.
   - 마운트 시 1회 랜덤 시드 생성 → SSR/리렌더 시 위치 고정.

2. **`src/index.css`**
   - `@keyframes drift`: `translateY(0)` ↔ `translateY(-30px)` 왕복 (12~20s, ease-in-out).
   - `@keyframes twinkle`: opacity 0.15 ↔ 0.7 (3~6s).
   - `@keyframes glow-pulse`: 기존 정적 blob의 opacity/scale 미세 호흡 (10~14s).

3. **`src/pages/Index.tsx`** (라인 161~183 배경 레이어)
   - 기존 정적 blob 두 개에 `glow-pulse` 애니메이션 클래스 추가.
   - `<HeroParticles />` 를 그리드 오버레이와 blob 사이에 삽입 (overflow-hidden 컨테이너 내부, z-index 자연 스택).
   - 헤드라인/검색바/트러스트 스트립은 손대지 않음.

### 동작 원칙
- 모두 CSS 애니메이션 (JS raf/canvas 없음) → 성능 부담 없음, 저사양·모바일 안전.
- `prefers-reduced-motion: reduce` 미디어 쿼리로 애니메이션 자동 비활성.
- 파티클은 최대 opacity 0.7, 크기 1~3px → 검색바 CTA 대비 확실히 후경에 머무름.

### 검증
- 프리뷰에서 히어로 캡처하여 파티클 산재 및 blob 호흡 확인.
- Reduced motion 환경에서 정적 상태 유지 확인.
