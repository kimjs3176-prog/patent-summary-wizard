import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DEFAULT_DOCUMENT_TITLE, formatDocumentTitle, useDocumentTitle } from "@/hooks/useDocumentTitle";
import { clampActiveIndex, nextActiveIndex } from "@/lib/listboxNavigation";
import { PatentInput } from "@/components/PatentInput";
import { ShareDialog } from "@/components/PatentSummary/toss/ShareDialog";
import { SearchHistory } from "@/components/SearchHistory";

describe("useDocumentTitle — each screen names itself", () => {
  it("formats '페이지명 | AIS' and falls back to the default title", () => {
    expect(formatDocumentTitle("특허 인사이트")).toBe("특허 인사이트 | AIS");
    expect(formatDocumentTitle("  '딸기'   검색 결과 ")).toBe("'딸기' 검색 결과 | AIS");
    expect(formatDocumentTitle("")).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(formatDocumentTitle(null)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("sets the title, follows changes and restores the default on unmount", () => {
    const { rerender, unmount } = renderHook(({ page }: { page: string | null }) => useDocumentTitle(page), {
      initialProps: { page: "일괄조회" as string | null },
    });
    expect(document.title).toBe("일괄조회 | AIS");
    rerender({ page: "딸기잼 제조 방법" });
    expect(document.title).toBe("딸기잼 제조 방법 | AIS");
    rerender({ page: null });
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
    rerender({ page: "관심특허" });
    unmount();
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
  });
});

describe("listbox keyboard navigation", () => {
  it("moves down and up with wrap-around, starting from no selection", () => {
    expect(nextActiveIndex(-1, "ArrowDown", 3)).toBe(0);
    expect(nextActiveIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextActiveIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextActiveIndex(-1, "ArrowUp", 3)).toBe(2);
    expect(nextActiveIndex(0, "ArrowUp", 3)).toBe(2);
    expect(nextActiveIndex(2, "ArrowUp", 3)).toBe(1);
  });

  it("handles empty and shrunken lists", () => {
    expect(nextActiveIndex(0, "ArrowDown", 0)).toBe(-1);
    expect(nextActiveIndex(5, "ArrowUp", 3)).toBe(1);
    expect(clampActiveIndex(5, 3)).toBe(2);
    expect(clampActiveIndex(1, 0)).toBe(-1);
    expect(clampActiveIndex(-1, 4)).toBe(-1);
  });
});

describe("PatentInput combobox", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("recent-keyword-searches", JSON.stringify(["딸기", "스마트팜"]));
  });

  const renderInput = (onKeywordSearch = vi.fn()) => {
    render(
      <MemoryRouter>
        <PatentInput onSubmit={vi.fn()} isLoading={false} onKeywordSearch={onKeywordSearch} skipKeywordFetch suggestions={["발효"]} />
      </MemoryRouter>,
    );
    return { input: screen.getByRole("combobox", { name: /특허번호, 키워드/ }), onKeywordSearch };
  };

  it("has an accessible name and announces the suggestion list", () => {
    const { input } = renderInput();
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox", { name: "검색 제안" });
    expect(input).toHaveAttribute("aria-controls", listbox.id);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["딸기", "스마트팜", "발효"]);
  });

  it("walks the options with arrow keys and searches the active one on Enter", () => {
    const { input, onKeywordSearch } = renderInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = screen.getByRole("option", { name: "스마트팜" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", active.id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "딸기" }).id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onKeywordSearch).toHaveBeenCalledWith([], "딸기");
  });

  it("closes on Escape and removes a recent keyword with Delete", () => {
    const { input } = renderInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Delete" });
    expect(screen.queryByRole("option", { name: "딸기" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("recent-keyword-searches") || "[]")).toEqual(["스마트팜"]);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("has no interactive element nested inside an option", () => {
    const { input } = renderInput();
    fireEvent.focus(input);
    for (const option of screen.getAllByRole("option")) {
      expect(option.querySelector("button, a, input, [role=button]")).toBeNull();
    }
  });
});

describe("ShareDialog", () => {
  const props = () => ({
    shareOpen: true,
    setShareOpen: vi.fn(),
    qrRef: { current: null } as React.RefObject<HTMLDivElement>,
    shareUrl: "https://example.com/?patent=1",
    downloadQr: vi.fn(),
    mailtoHref: "mailto:?subject=x",
    copyLink: vi.fn(async () => {}),
    copied: false,
  });

  it("is a labelled modal dialog that closes on Escape", async () => {
    const p = props();
    render(<ShareDialog {...p} />);
    const dialog = screen.getByRole("dialog", { name: "요약서 전송하기" });
    expect(dialog).toBeInTheDocument();
    // The QR library loads lazily, and qrRef still finds the <svg> inside the portal.
    await waitFor(() => expect(p.qrRef.current?.querySelector("svg")).not.toBeNull());
    act(() => { fireEvent.keyDown(dialog, { key: "Escape" }); });
    expect(p.setShareOpen).toHaveBeenCalledWith(false);
  });

  it("returns focus to the button that opened it", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>이메일·QR로 전송하기</button>
          <ShareDialog {...props()} shareOpen={open} setShareOpen={setOpen} />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "이메일·QR로 전송하기" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("renders nothing while closed", () => {
    render(<ShareDialog {...props()} shareOpen={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("SearchHistory cards", () => {
  it("keeps the delete button outside the card button with a descriptive label", () => {
    const onRemove = vi.fn();
    const onSelect = vi.fn();
    render(
      <SearchHistory
        history={[{ patentNumber: "1020210162560", patentData: { title: "딸기 재배 장치" }, summary: "", relatedPatents: [], searchedAt: "" }]}
        onSelect={onSelect}
        onRemove={onRemove}
        onClear={vi.fn()}
      />,
    );
    const del = screen.getByRole("button", { name: "딸기 재배 장치 기록 삭제" });
    expect(del.closest("button")?.parentElement?.closest("button")).toBeNull();
    fireEvent.click(del);
    expect(onRemove).toHaveBeenCalledWith("1020210162560");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
