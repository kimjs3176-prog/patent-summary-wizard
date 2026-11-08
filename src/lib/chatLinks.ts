/**
 * 상담 답 속 맨 'www.' 주소를 마크다운 링크로 바꾼다. 답 문장은 'NATI(www.nati.or.kr)에서'처럼 주소 뒤에 괄호와
 * 한글이 바로 붙어, 마크다운의 자동 링크가 ')에서'까지 주소로 삼아 없는 주소가 열렸다.
 * 주소 뒤의 경로(/apply 등)는 링크에 넣고, 끝의 문장부호·괄호·한글은 뺀다.
 * 이미 링크인 주소(https://…, [..](..), <..>), 링크 글자 안의 주소, 코드 안의 주소는 그대로 둔다. (정규식 lookbehind 는
 * 옛 사파리에서 오류가 나므로 앞 글자를 잡아 확인한다.)
 */
const BARE_WWW = /(^|[^\w/[@.`<-])(www\.[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?(?:[/?#][\w\-.~%!$&'*+,;=:@/?#]*)?)/g;
const TRAILING_PUNCTUATION = /[.,;:!?'*~_]+$/;

/** 주소 앞까지의 글이 코드(``` 묶음이나 `…`) 안이거나, 아직 닫히지 않은 링크 글자 '[' 안인지 */
function insideCodeOrLinkText(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  if ((before.match(/```/g) || []).length % 2 === 1) return true;
  const line = before.slice(before.lastIndexOf("\n") + 1);
  if ((line.replace(/```/g, "").match(/`/g) || []).length % 2 === 1) return true;
  return line.lastIndexOf("[") > line.lastIndexOf("]");
}

export function linkifyBareWww(text: string): string {
  return text.replace(BARE_WWW, (match: string, before: string, found: string, offset: number, whole: string) => {
    // [이름](www.…) 처럼 이미 링크 주소 자리에 있으면 건드리지 않는다
    if (before === "(" && whole[offset - 1] === "]") return match;
    if (insideCodeOrLinkText(whole, offset + before.length)) return match;
    const trailing = (found.match(TRAILING_PUNCTUATION) || [""])[0];
    const url = found.slice(0, found.length - trailing.length);
    return `${before}[${url}](https://${url})${trailing}`;
  });
}
