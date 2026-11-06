import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FoodConsortium from "@/pages/FoodConsortium";

const { invoke, toggle } = vi.hoisted(() => ({ invoke: vi.fn(), toggle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/components/layout/PageLayout", () => ({ PageLayout: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/search/useCardFavorites", () => ({
  useCardFavorites: () => ({ enabled: true, isFavorite: () => false, toggle }),
}));
vi.mock("@/components/search/FavoriteToggle", () => ({
  FavoriteToggle: ({ onToggle }: { onToggle: () => void }) => <button onClick={onToggle}>관심특허 저장</button>,
}));

const A = "한국식품연구원";
const B = "한국생명공학연구원";
type Reply = { data: unknown; error: Error | null };
const pending: { org: string; page: number; resolve: (reply: Reply) => void }[] = [];
const reply = (org: string, page = 1, hasMore = false): Reply => ({
  error: null,
  data: {
    success: true, org, page, hasMore, codes: [org === A ? "111111111111" : "222222222222"], total: 2,
    items: [{ applicationNumber: `${org}-${page}`, title: `${org} 특허 ${page}`, applicant: "", applicationDate: "20261106", status: "등록" }],
  },
});
const select = (org: string) => fireEvent.click(screen.getByTitle(org));
const finish = async (index: number, response: Reply) => {
  await act(async () => { pending[index].resolve(response); });
};

beforeEach(() => {
  pending.length = 0;
  vi.clearAllMocks();
  invoke.mockImplementation((_fn, { body }: { body: { org: string; page: number } }) =>
    new Promise<Reply>((resolve) => pending.push({ ...body, resolve })));
  render(<MemoryRouter initialEntries={["/consortium"]}><FoodConsortium /></MemoryRouter>);
});
afterEach(cleanup);

describe("협의체 기관 변경 중 요청 순서", () => {
  it("먼저 선택한 기관의 늦은 응답이 현재 기관의 특허·코드·관심특허를 덮어쓰지 않는다", async () => {
    select(A);
    select(B);
    await finish(1, reply(B));
    await finish(0, reply(A));
    expect(screen.queryByText(`${A} 특허 1`)).toBeNull();
    expect(screen.getByText(`${B} 특허 1`)).toBeInTheDocument();
    expect(screen.queryByText("111111111111")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "관심특허 저장" }));
    expect(toggle).toHaveBeenCalledWith(expect.objectContaining({ assignee: B, applicationNumber: `${B}-1` }));
  });

  it("이전 기관의 오류가 현재 요청의 로딩을 끝내거나 오류를 표시하지 않는다", async () => {
    select(A);
    select(B);
    await finish(0, { data: null, error: new Error("이전 기관 실패") });
    expect(screen.queryByText("이전 기관 실패")).toBeNull();
    expect(screen.getByText("특허고객번호로 특허를 찾는 중…")).toBeInTheDocument();
    await finish(1, reply(B));
    expect(screen.getByText(`${B} 특허 1`)).toBeInTheDocument();
  });

  it("더 보기의 늦은 응답도 다른 기관 목록에 추가하지 않는다", async () => {
    select(A);
    await finish(0, reply(A, 1, true));
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    select(B);
    await finish(2, reply(B));
    await finish(1, reply(A, 2));
    expect(screen.queryByText(`${A} 특허 2`)).toBeNull();
    expect(screen.getByText(`${B} 특허 1`)).toBeInTheDocument();
  });

  it("기관 선택을 해제하면 진행 중인 응답을 무시한다", async () => {
    select(A);
    select(A);
    await finish(0, reply(A));
    select(B);
    expect(screen.queryByText(`${A} 특허 1`)).toBeNull();
    await finish(1, reply(B));
    expect(screen.getByText(`${B} 특허 1`)).toBeInTheDocument();
  });

  it("같은 기관을 다시 선택해도 첫 요청은 최신 요청을 덮어쓰지 않는다", async () => {
    select(A);
    select(B);
    select(A);
    await finish(2, reply(A, 3));
    await finish(1, reply(B));
    await finish(0, reply(A));
    expect(screen.getByText(`${A} 특허 3`)).toBeInTheDocument();
    expect(screen.queryByText(`${A} 특허 1`)).toBeNull();
    expect(screen.queryByText(`${B} 특허 1`)).toBeNull();
  });

  it("현재 기관의 더 보기는 기존 특허를 유지하며 다음 페이지를 추가한다", async () => {
    select(A);
    await finish(0, reply(A, 1, true));
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(pending[1]).toEqual(expect.objectContaining({ org: A, page: 2 }));
    await finish(1, reply(A, 2));
    expect(screen.getByText(`${A} 특허 1`)).toBeInTheDocument();
    expect(screen.getByText(`${A} 특허 2`)).toBeInTheDocument();
  });
});