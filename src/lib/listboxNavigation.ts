/**
 * 검색창 콤보박스(제안·기록 목록)의 키보드 이동 규칙.
 * 화면과 분리된 순수 함수라 단위 테스트로 검증한다.
 */
export type ListboxKey = "ArrowDown" | "ArrowUp";

/** -1은 "선택된 항목 없음"(포커스는 입력창에 그대로). 끝에서 처음으로, 처음에서 끝으로 순환한다. */
export function nextActiveIndex(current: number, key: ListboxKey, count: number): number {
  if (count <= 0) return -1;
  const cur = Math.min(current, count - 1);
  if (key === "ArrowDown") return cur < 0 || cur >= count - 1 ? 0 : cur + 1;
  return cur <= 0 ? count - 1 : cur - 1;
}

/** 목록이 줄어든 뒤(삭제·필터링)에도 활성 항목이 범위 안에 있게 한다. */
export function clampActiveIndex(current: number, count: number): number {
  if (count <= 0 || current < 0) return -1;
  return Math.min(current, count - 1);
}
