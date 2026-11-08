/**
 * 일괄조회 '조건으로 불러오기'의 한 번 요청 크기와 실패 안내.
 *
 * 발명자 이름은 KIPRIS 목록에 없어 서버가 건마다 상세 조회를 한 번 더 한다. 500건에 발명자까지 받으면 한 번에
 * 1분 넘게 걸려 시간 초과로 끝났으므로(실측: 목록 500건 약 8초, 발명자 포함 50건 약 9~11초), 발명자를 넣을 때만
 * 작게 나눠 받는다. 50건 이하는 서버의 발명자 조회 한도에도 걸리지 않는다.
 */
export const criteriaPageSize = (withInventors: boolean): number => (withInventors ? 50 : 500);

export const CRITERIA_TIMEOUT_MESSAGE = "조회가 오래 걸려 멈췄어요. 기간을 좁혀 다시 시도해 주세요.";
export const CRITERIA_SERVER_MESSAGE = "목록을 받지 못했어요. 기간을 좁혀 다시 시도해 주세요.";
export const CRITERIA_NETWORK_MESSAGE = "인터넷 연결을 확인하고 다시 시도해 주세요.";

/** 조회 실패를 쉬운 한국어로 바꾼다. 이 화면이 직접 만든 한국어 안내(요청 한도·입력 확인)는 그대로 둔다. */
export function criteriaErrorMessage(err: unknown): string {
  const name = typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "AbortError" || name === "TimeoutError") return CRITERIA_TIMEOUT_MESSAGE;
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/failed to fetch|load failed|network/i.test(message)) return CRITERIA_NETWORK_MESSAGE;
  return /[가-힣]/.test(message) ? message : CRITERIA_SERVER_MESSAGE;
}
