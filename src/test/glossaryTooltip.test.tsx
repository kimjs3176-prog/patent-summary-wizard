import { readFileSync } from "node:fs";
import path from "node:path";
import { isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const SRC = path.resolve(__dirname, "../components/GlossaryTooltip.tsx");
const termsOf = (nodes: ReactNode[]) =>
  nodes.filter(isValidElement).map((n) => (n.props as { term: string }).term);

describe("GlossaryTooltip — opens on browsers without regex lookbehind (iOS Safari < 16.4)", () => {
  const NativeRegExp = RegExp;
  afterEach(() => {
    globalThis.RegExp = NativeRegExp;
    vi.resetModules();
  });

  it("has no lookbehind in its source", () => {
    expect(readFileSync(SRC, "utf8")).not.toMatch(/\(\?<[=!]/);
  });

  it("loads and annotates when the RegExp engine rejects lookbehind", async () => {
    function NoLookbehind(this: unknown, p: string | RegExp, f?: string) {
      const src = p instanceof NativeRegExp ? p.source : String(p);
      if (/\(\?<[=!]/.test(src)) throw new SyntaxError("Invalid regular expression: invalid group specifier name");
      return new NativeRegExp(p, f);
    }
    NoLookbehind.prototype = NativeRegExp.prototype;
    Object.setPrototypeOf(NoLookbehind, NativeRegExp);
    globalThis.RegExp = NoLookbehind as unknown as RegExpConstructor;
    vi.resetModules();
    const mod = await import("@/components/GlossaryTooltip");
    expect(termsOf(mod.annotateWithGlossary("균주와 AI 를 쓴다"))).toEqual(["균주", "AI"]);
    expect(termsOf(mod.annotateWithGlossary("페룰린산 처리", { 페룰린산: "식물 성분" }))).toEqual(["페룰린산"]);
  });

  it("keeps ASCII terms on word boundaries without lookbehind", async () => {
    const { annotateWithGlossary } = await import("@/components/GlossaryTooltip");
    expect(termsOf(annotateWithGlossary("MAIN RAID HELLO"))).toEqual([]);
    expect(termsOf(annotateWithGlossary("XAI 말고 AI기반 IoT·GPS"))).toEqual(["AI", "IoT", "GPS"]);
    expect(termsOf(annotateWithGlossary("(PCR)과 5G, CRISPRs"))).toEqual(["PCR", "5G"]);
    // 앞 글자로 걸러진 자리 바로 뒤에서도 다시 찾는다
    expect(termsOf(annotateWithGlossary("MAIAI AI"))).toEqual(["AI"]);
    const text = "앞 MAIN 뒤 AI 끝";
    const parts = annotateWithGlossary(text);
    expect(parts.map((n) => (isValidElement(n) ? (n.props as { term: string }).term : n)).join("")).toBe(text);
  });
});

describe("GlossaryTooltip — opens by tap and keyboard (FE-7)", () => {
  it("toggles on press, opens on focus, Enter toggles and Escape closes", async () => {
    const { annotateWithGlossary } = await import("@/components/GlossaryTooltip");
    render(<p>{annotateWithGlossary("미생물 균주를 쓴다")}</p>);
    const term = screen.getByRole("button", { name: "균주" });
    expect(term.tabIndex).toBe(0);
    const tip = () => screen.queryAllByRole("tooltip").length;

    // 휴대폰 탭: 누르면 열리고 다시 누르면 닫힌다
    act(() => {
      fireEvent.pointerDown(term, { pointerType: "touch" });
      fireEvent.click(term);
    });
    expect(tip()).toBe(1);
    expect(screen.getAllByText(/순수 배양된 단일 계통/).length).toBeGreaterThan(0);
    act(() => {
      fireEvent.pointerDown(term, { pointerType: "touch" });
      fireEvent.click(term);
    });
    expect(tip()).toBe(0);

    // 키보드: Tab 으로 가면 열리고(포커스 때 생기는 스크롤로 바로 닫히지 않는다), Esc 로 닫고, Enter 로 다시 연다
    act(() => { term.blur(); });
    act(() => { term.focus(); });
    expect(tip()).toBe(1);
    act(() => { document.dispatchEvent(new Event("scroll")); });
    expect(tip()).toBe(1);
    act(() => { fireEvent.keyDown(document.activeElement || term, { key: "Escape" }); });
    expect(tip()).toBe(0);
    act(() => { fireEvent.keyDown(term, { key: "Enter" }); });
    expect(tip()).toBe(1);
    act(() => { fireEvent.keyDown(document.activeElement || term, { key: "Escape" }); });
    expect(tip()).toBe(0);
    // 포커스를 떠나면 닫힌다
    act(() => { fireEvent.keyDown(term, { key: "Enter" }); });
    expect(tip()).toBe(1);
    act(() => { term.blur(); });
    expect(tip()).toBe(0);
  });
});
