import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it, expect } from "vitest";

const html = readFileSync("public/filing-app/index.html", "utf8");
const parser = html.slice(html.indexOf("function analyzePitch(text)"), html.indexOf("// 문장에서 뽑은 낱말을 분야 틀"));
const keep = html.match(/const PITCH_NOUN_KEEP = ([^;]+);/)?.[1];
function keywords(text: string): string[] {
  if (!keep || !parser) throw new Error("출원도우미 추출 함수를 찾지 못했습니다.");
  return runInNewContext(`const PITCH_NOUN_KEEP = ${keep}; ${parser}; analyzePitch(text).kws`, {
    text, PITCH_DROP: /^(위한|기술|및|상기|이의|이를)$/, PITCH_DEVICE: /장치$/, PITCH_METHOD: /방법$/,
    FIELD_GUESS: [], guessField: () => "food", lastOf: (xs: unknown[]) => xs[xs.length - 1],
  });
}
describe("출원도우미 자체 키워드 추출", () => {
  it("복합 조사도 제거", () => {
    expect(Array.from(keywords("딸기의 온실에서는 저장을"))).toEqual(["딸기", "온실", "저장"]);
  });
  it("알로에·농가·단가·효과를 훼손하지 않음", () => {
    expect(Array.from(keywords("알로에 농가 단가 효과"))).toEqual(["알로에", "농가", "단가", "효과"]);
  });
});