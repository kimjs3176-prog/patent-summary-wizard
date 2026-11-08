import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 앱 코드(테스트 제외)는 옛 사파리에서도 열려야 한다. 정규식 lookbehind 는 iOS 16.4 미만에서 화면 전체 오류,
// Array.prototype.at 은 iOS 15.4 미만에서 오류가 난다 (tsconfig 는 ES2020, 빌드는 이를 바꿔 주지 않는다).
const appFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "test" ? [] : appFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

describe("옛 브라우저에서 깨지는 문법", () => {
  // 출원도우미(public/filing-app)는 한 파일에 앱 전체가 들어 있어, 한 곳만 걸려도 화면 전체가 빈다
  const files = [...appFiles("src"), "public/filing-app/index.html"].map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it("정규식 lookbehind (?<= (?<! 를 쓰지 않는다", () => {
    expect(files.filter((f) => /\(\?<[=!]/.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it("배열·문자열의 .at() 을 쓰지 않는다", () => {
    expect(files.filter((f) => /\.at\(/.test(f.text)).map((f) => f.path)).toEqual([]);
  });
});
