/** Preserve a short, explicit negative purpose when AI rewrites a search request.
 * Only a complete short need plus a conversational tail qualifies; other constraints
 * and longer sentences remain untouched.
 */
export function negativeNeedParts(raw: string): { target: string; modifier: string; query: string } | null {
  const match = raw.trim().match(/^([가-힣]{1,8}지)\s*(않는|않은)\s+([가-힣]{1,12}?)(?:\s+(?:기술|특허|검색|제조\s*기술))?(?:\s+(?:기술\s*검색|기술|특허))?(?:\s*(?:있을까요?|있나요?|찾아\s*줘|추천해\s*줘|알려\s*줘|알려\s*주세요))?[?？.!]*$/u);
  if (!match) return null;
  const modifier = `${match[1]} ${match[2]}`;
  const target = match[3];
  return { target, modifier, query: `${modifier} ${target}` };
}