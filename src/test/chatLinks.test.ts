import { describe, expect, it } from "vitest";
import { linkifyBareWww } from "@/lib/chatLinks";

describe("상담 답 속 www 주소", () => {
  it("괄호·한글이 바로 붙은 주소를 바른 링크로 바꾼다", () => {
    expect(linkifyBareWww("NATI(www.nati.or.kr)에서 신청합니다")).toBe("NATI([www.nati.or.kr](https://www.nati.or.kr))에서 신청합니다");
    expect(linkifyBareWww("KIPRIS(www.kipris.or.kr)를 참고")).toBe("KIPRIS([www.kipris.or.kr](https://www.kipris.or.kr))를 참고");
    expect(linkifyBareWww("www.nati.or.kr.")).toBe("[www.nati.or.kr](https://www.nati.or.kr).");
  });

  it("주소 뒤의 경로는 링크에 넣고, 끝의 문장부호·괄호·한글은 뺀다", () => {
    expect(linkifyBareWww("www.nati.or.kr/apply 에서")).toBe("[www.nati.or.kr/apply](https://www.nati.or.kr/apply) 에서");
    expect(linkifyBareWww("NATI(www.nati.or.kr/main.do)에서")).toBe("NATI([www.nati.or.kr/main.do](https://www.nati.or.kr/main.do))에서");
    expect(linkifyBareWww("주소: www.kipris.or.kr/khome/main.do?x=1.")).toBe("주소: [www.kipris.or.kr/khome/main.do?x=1](https://www.kipris.or.kr/khome/main.do?x=1).");
    expect(linkifyBareWww("**www.nati.or.kr**")).toBe("**[www.nati.or.kr](https://www.nati.or.kr)**");
  });

  it("이미 링크인 주소, 링크 글자 안의 주소, 코드·메일 주소는 그대로 둔다", () => {
    for (const text of [
      "또는 https://www.nati.or.kr 에서",
      "[www.nati.or.kr](https://www.nati.or.kr)",
      "[NATI](www.nati.or.kr)",
      "[NATI 누리집 www.nati.or.kr](https://www.nati.or.kr)",
      "[국가농림기술이전정보시스템(www.nati.or.kr)](https://www.nati.or.kr)",
      "`www.nati.or.kr`",
      "`주소 www.nati.or.kr`",
      "```\nwww.nati.or.kr\n```",
      "<www.nati.or.kr>",
      "help@www.nati.or.kr",
    ]) expect(linkifyBareWww(text)).toBe(text);
  });
});
