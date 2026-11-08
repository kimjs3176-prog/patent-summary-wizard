/**
 * 방문 수 '오늘' 행의 날짜. 서버(increment_daily_visit)는 데이터베이스 날짜(UTC 의 CURRENT_DATE)로 세므로 같은
 * 기준으로 찾는다. 한국 날짜로 찾으면 한국 시각 0~9시에는 아직 없는 날짜를 찾아 '오늘 0'이 됐다.
 * 서버를 한국 날짜로 세게 바꾸는 마이그레이션을 넣을 때는 이것도 함께 한국 날짜로 바꾼다.
 */
export const visitDateKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);
