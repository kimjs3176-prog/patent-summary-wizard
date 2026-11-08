import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Tabs } from "@/components/ui/tabs";
import { AdminSummaryPanel } from "@/components/admin/AdminSummaryPanel";
import { AdminOutputPanel } from "@/components/admin/AdminOutputPanel";
import { DEFAULT_SCORE_CONFIG, DEFAULT_TRL_CONFIG } from "@/components/admin/ScoreTrlSettings";
import { DEFAULT_PDF_CONFIG } from "@/components/admin/PdfLayoutSettings";
import {
  DEFAULT_CARD_ICONS, DEFAULT_INFO_LABELS, DEFAULT_PRINT_SECTIONS, DEFAULT_SECTION_LENGTHS, DEFAULT_SECTION_TITLES, DEFAULT_VISIBLE_SECTIONS,
} from "@/components/admin/adminPageConstants";

const noop = vi.fn();
// 슬라이더(Radix)가 쓰는 ResizeObserver 가 jsdom 에는 없다
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

function summaryPanel(currentModel: string | null) {
  return render(
    <Tabs value="summary">
      <AdminSummaryPanel
        summaryTitles={DEFAULT_SECTION_TITLES} setSummaryTitles={noop}
        summarySectionLengths={DEFAULT_SECTION_LENGTHS} setSummarySectionLengths={noop}
        summaryDisclaimer="※ 문구" setSummaryDisclaimer={noop}
        summaryVisibleSections={DEFAULT_VISIBLE_SECTIONS} setSummaryVisibleSections={noop}
        summaryAiPromptExtra="" setSummaryAiPromptExtra={noop}
        summaryCardIcons={DEFAULT_CARD_ICONS} setSummaryCardIcons={noop}
        summaryInfoLabels={DEFAULT_INFO_LABELS} setSummaryInfoLabels={noop}
        isSavingSummarySettings={false} newSectionKey="" setNewSectionKey={noop}
        summaryMaxTokens={3000} setSummaryMaxTokens={noop}
        scoreConfig={DEFAULT_SCORE_CONFIG} setScoreConfig={noop}
        trlConfig={DEFAULT_TRL_CONFIG} setTrlConfig={noop}
        handleSaveSummarySettings={async () => {}}
        currentModel={currentModel}
      />
    </Tabs>,
  );
}

describe("관리자 설정: 반영되지 않는 칸은 '현재 쓰지 않음'으로 잠그고, AI 모델은 실제 값", () => {
  it("요약서 탭: 실제 모델을 보이고, 효과 없는 칸(아이콘·라벨·표시/숨김·분량·점수 비중)은 잠근다", () => {
    const { container } = summaryPanel("google/gemini-3.8-flash");
    expect(screen.queryByText(/Gemini 3 Flash Preview/)).toBeNull();
    expect(container.querySelector("[data-current-model]")?.textContent).toContain("gemini-3.8-flash");
    expect(screen.getAllByText("현재 쓰지 않음").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText(/기술사업화점수 설정 · 현재 쓰지 않음/)).toBeInTheDocument();
    expect(screen.queryByText(/값이 클수록 더 상세한 요약/)).toBeNull();
    expect(screen.queryByText(/비중\/등급 변경 후/)).toBeNull();
    for (const box of container.querySelectorAll("[data-unused-setting]")) {
      for (const el of box.querySelectorAll("input, button")) expect((el as HTMLInputElement).matches(":disabled")).toBe(true);
    }
    // 실제로 쓰는 칸은 그대로 고칠 수 있다: 면책 문구(화면 아래 안내문)
    expect(screen.getByDisplayValue("※ 문구")).not.toBeDisabled();
  });

  it("모델 이름을 불러오기 전에는 고정 모델 이름 대신 '불러오는 중'", () => {
    const { container } = summaryPanel(null);
    expect(within(container.querySelector("[data-current-model]") as HTMLElement).getByText("불러오는 중…")).toBeInTheDocument();
  });

  it("모델 이름을 불러오지 못하면 '불러오는 중'에 머물지 않고 '확인하지 못했습니다'", () => {
    const { container } = summaryPanel("");
    expect(within(container.querySelector("[data-current-model]") as HTMLElement).getByText("확인하지 못했습니다")).toBeInTheDocument();
  });

  it("출력 탭: 인쇄 항목·PDF 레이아웃은 반영되지 않는다고 알리고 잠근다", () => {
    const { container } = render(
      <Tabs value="output">
        <AdminOutputPanel printSections={DEFAULT_PRINT_SECTIONS} setPrintSections={noop} isSavingPrintSettings={false}
          pdfLayoutConfig={DEFAULT_PDF_CONFIG} apiCall={vi.fn()} handleSavePrintSettings={async () => {}} />
      </Tabs>,
    );
    expect(screen.queryByText(/저장 후 인쇄 시 선택한 항목만 포함됩니다/)).toBeNull();
    expect(screen.getAllByText("현재 쓰지 않음").length).toBeGreaterThanOrEqual(1);
    const save = screen.getByRole("button", { name: /인쇄 설정 저장/ });
    expect(save).toBeDisabled();
    expect(container.querySelector("[data-unused-setting]")).not.toBeNull();
  });
});
