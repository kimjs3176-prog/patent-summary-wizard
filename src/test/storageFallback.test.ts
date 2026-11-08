import { describe, expect, it } from "vitest";
import { createMemoryStorage, installStorageFallback } from "@/lib/storageFallback";

/** 사이트 데이터 저장을 막은 브라우저처럼: 저장소를 읽기만 해도 SecurityError */
const blockedWindow = (names: string[]) => {
  const win = {} as Window;
  for (const name of names) {
    Object.defineProperty(win, name, {
      configurable: true,
      get: () => {
        throw new DOMException(`Failed to read the '${name}' property from 'Window': Access is denied for this document.`, "SecurityError");
      },
    });
  }
  return win;
};

describe("저장소가 막힌 브라우저", () => {
  it("막힌 저장소는 메모리 저장소로 바꿔 앱이 읽고 쓸 수 있게 한다", () => {
    const win = blockedWindow(["localStorage", "sessionStorage"]);
    expect(installStorageFallback(win)).toEqual(["localStorage", "sessionStorage"]);
    win.localStorage.setItem("font-scale", "1.15");
    expect(win.localStorage.getItem("font-scale")).toBe("1.15");
    expect(win.sessionStorage.getItem("splash-shown")).toBeNull();
  });

  it("쓸 수 있는 저장소는 그대로 둔다", () => {
    const real = createMemoryStorage();
    const win = blockedWindow(["sessionStorage"]);
    Object.defineProperty(win, "localStorage", { configurable: true, value: real });
    expect(installStorageFallback(win)).toEqual(["sessionStorage"]);
    expect(win.localStorage).toBe(real);
  });

  it("메모리 저장소는 Storage 처럼 동작한다", () => {
    const s = createMemoryStorage();
    s.setItem("a", "1");
    s.setItem("b", "2");
    expect(s.length).toBe(2);
    expect(s.key(0)).toBe("a");
    s.removeItem("a");
    expect(s.getItem("a")).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
  });

  it("main.tsx 는 앱보다 먼저 이 모듈을 불러온다", async () => {
    const { readFileSync } = await import("node:fs");
    const firstImport = readFileSync("src/main.tsx", "utf8").split("\n").find((l) => l.startsWith("import "));
    expect(firstImport).toBe('import "./lib/storageFallback";');
  });
});
