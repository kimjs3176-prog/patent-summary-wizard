/**
 * 인기 검색 집계는 방문 기록 한 칸(라우터 location.key)마다 한 번만 센다. 요약서는 주소(?patent=)를 따라 열리므로
 * '뒤로·앞으로'로 같은 칸에 돌아오면 요약서를 다시 불러오는데, 그때마다 세면 인기 순위가 이동만으로 부푼다.
 * 새로 검색하면 새 칸이라 다시 센다. 새로고침하면 이 기억도 사라져 처음처럼 센다.
 */
const counted = new Set<string>();

export function shouldCountPopular(entryKey: string): boolean {
  if (counted.has(entryKey)) return false;
  counted.add(entryKey);
  return true;
}
