import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { settings } = vi.hoisted(() => ({ settings: { current: {} as Record<string, string> } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(async () => ({ error: null })) } }));
vi.mock("@/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({ settings: settings.current, isLoading: false }) }));
vi.mock("@/components/VisitorCounter", () => ({ VisitorCounter: () => null }));
vi.mock("@/components/KioskKeyboard", () => ({ KioskKeyboard: () => null }));
vi.mock("@/components/layout/SiteNav", () => ({ SiteNavLinks: () => null, SiteNavPanel: () => null }));

import Filing from "@/pages/Filing";
import { PageLayout } from "@/components/layout/PageLayout";
import { SatisfactionPanel } from "@/components/SatisfactionPanel";

afterEach(() => {
  cleanup();
  settings.current = {};
  sessionStorage.clear();
});

const page = (ui: ReactNode) => render(<MemoryRouter initialEntries={["/filing"]}>{ui}</MemoryRouter>);

describe("출원도우미 화면 이름 — 메뉴(services.ts)와 같은 ‘출원도우미’ 하나만 쓴다", () => {
  // 처음 열 때 뜨는 면책 안내(아래 따로 확인)는 이미 본 것으로 둔다
  beforeEach(() => sessionStorage.setItem("filing_notice_seen", "1"));

  it("탭 제목·제목·안내줄·iframe 이름이 모두 출원도우미이고 옛 이름이 없다", () => {
    const { container } = page(<Filing />);
    expect(document.title).toBe("출원도우미 | AIS");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("출원도우미");
    expect(screen.getByRole("note")).toHaveTextContent(/^개발 중\s*출원도우미는 개발 중인 기능이라/);
    expect(container.querySelector("iframe")).toHaveAttribute("title", "출원도우미");
    expect(container.textContent).not.toMatch(/출원지원|에이프|Agri-IP/);
  });

  it("도움말 버튼 설명에 지운 ‘작업 파일 내보내기’가 없다", () => {
    page(<Filing />);
    expect(screen.getByRole("button", { name: "도움말" })).toHaveAttribute("title", "도움말 · 진행 상황");
  });

  it("저장 안내는 검색·AI 버튼을 누를 때만 내용이 서버로 간다고 알린다", () => {
    const { container } = page(<Filing />);
    expect(container.textContent).toMatch(/작성 내용은 이 브라우저에만 저장됩니다\. 검색·AI 버튼을 누를 때만 그 내용이 서버로 갑니다\./);
  });

  it("꺼져 있을 때 안내도 같은 이름을 쓴다", () => {
    settings.current = { feature_filing: "false" };
    page(<Filing />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("출원도우미는 지금 꺼져 있습니다");
    expect(document.body.textContent).toMatch(/‘출원도우미’를 켜면/);
  });
});

describe("면책 안내 — 처음 열 때 결과물이 출원·등록을 보장하지 않는다고 알린다 (owner)", () => {
  it("한 번 뜨고, 확인하면 닫히며 같은 탭에서는 다시 뜨지 않는다", () => {
    page(<Filing />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("특허 출원이나 등록을 보장하지 않아요.");
    fireEvent.click(screen.getByRole("button", { name: "확인했어요" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sessionStorage.getItem("filing_notice_seen")).toBe("1");
    cleanup();
    page(<Filing />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("출원도우미가 꺼져 있으면 띄우지 않는다", () => {
    settings.current = { feature_filing: "false" };
    page(<Filing />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("개인정보 안내 — 이 서비스는 개인정보를 받지 않는다", () => {
  it("만족도 의견 칸은 개인정보를 적지 말라는 안내로 설명된다", () => {
    render(<SatisfactionPanel patentNumber="1020200123456" />);
    expect(screen.getByRole("textbox", { name: /개선 의견/ })).toHaveAccessibleDescription(/이름·연락처 같은 개인정보는 적지 마세요/);
  });

  it("모든 화면의 바닥글이 개인정보를 받지 않고 방문·검색은 횟수만 센다고 알린다", () => {
    page(<PageLayout><p>본문</p></PageLayout>);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("이 서비스는 이름·연락처 같은 개인정보를 받지 않습니다. 방문과 검색은 횟수만 셉니다.");
  });
});
