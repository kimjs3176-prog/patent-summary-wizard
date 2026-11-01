import { describe, it, expect } from "vitest";
import {
  FILING_DEFAULT_URL,
  buildFilingSrc,
  buildFilingStandaloneUrl,
  filingBaseUrl,
  filingEnabled,
  normalizeFilingPage,
  parseFilingMessage,
} from "@/lib/filing";

describe("출원지원(에이프) 연결", () => {
  it("기본은 켜짐, 'false' 일 때만 꺼짐", () => {
    expect(filingEnabled({})).toBe(true);
    expect(filingEnabled({ feature_filing: "true" })).toBe(true);
    expect(filingEnabled({ feature_filing: "false" })).toBe(false);
  });

  it("주소는 https 만 받고, 비어 있거나 이상하면 기본 주소", () => {
    expect(filingBaseUrl({})).toBe(FILING_DEFAULT_URL);
    expect(filingBaseUrl({ filing_url: "  " })).toBe(FILING_DEFAULT_URL);
    expect(filingBaseUrl({ filing_url: "http://evil.example/" })).toBe(FILING_DEFAULT_URL);
    expect(filingBaseUrl({ filing_url: "not a url" })).toBe(FILING_DEFAULT_URL);
    expect(filingBaseUrl({ filing_url: "https://agri-ip.example.org" })).toBe("https://agri-ip.example.org/");
    expect(filingBaseUrl({ filing_url: "https://agri-ip.example.org/app?x=1#idea" })).toBe("https://agri-ip.example.org/app/");
    expect(filingBaseUrl({ filing_url: "http://localhost:8097/" })).toBe("http://localhost:8097/");
  });

  it("단계 이름은 아는 것만, 쪽 이름은 영문만", () => {
    expect(normalizeFilingPage(null)).toBe("idea");
    expect(normalizeFilingPage("#manage/overseas")).toBe("manage/overseas");
    expect(normalizeFilingPage("global")).toBe("global");
    expect(normalizeFilingPage("javascript:alert(1)")).toBe("idea");
    expect(normalizeFilingPage("draft/<b>")).toBe("draft");
  });

  it("iframe 주소: 임베드 표시 + 단계, 비교 특허는 선행기술 조사 쪽으로", () => {
    expect(buildFilingSrc({})).toBe(`${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#idea`);
    expect(buildFilingSrc({}, { page: "manage/overseas" })).toBe(`${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#manage/overseas`);
    expect(buildFilingSrc({}, { page: "draft", cite: "10-2020-0123456", title: "딸기 포장 <b>" })).toBe(
      `${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#prior?cite=1020200123456&title=%EB%94%B8%EA%B8%B0+%ED%8F%AC%EC%9E%A5+%3Cb%3E`,
    );
    // 13자리가 아니면 비교 특허로 넣지 않는다
    expect(buildFilingSrc({}, { cite: "10-2920574" })).toBe(`${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#idea`);
  });

  it("키워드로 새로 시작: 1단계 + kw, 분야는 영문 코드만", () => {
    expect(buildFilingSrc({}, { page: "manage", kw: " 쌀겨, 발효 ", field: "bio" })).toBe(
      `${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#idea?kw=%EC%8C%80%EA%B2%A8%2C+%EB%B0%9C%ED%9A%A8&field=bio`,
    );
    expect(buildFilingSrc({}, { kw: "김치", field: "x y" })).toBe(`${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#idea?kw=%EA%B9%80%EC%B9%98`);
  });

  it("새 창 주소에는 임베드 표시가 없다", () => {
    expect(buildFilingStandaloneUrl({}, { page: "prior" })).toBe(`${FILING_DEFAULT_URL}#prior`);
  });

  it("강조색은 hsl(…)·#rrggbb 만 주소에 싣는다", () => {
    expect(buildFilingSrc({}, { accent: "hsl(158 68% 30%)" })).toBe(`${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light&accent=hsl%28158+68%25+30%25%29#idea`);
    expect(buildFilingSrc({}, { accent: "url(x)" })).toBe(`${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#idea`);
  });

  it("상태 메시지는 형식을 맞추고 문자열을 자른다", () => {
    const origin = "https://koat-axlab.vercel.app";
    const m = parseFilingMessage({ origin, data: { type: "agri-ip:state", mode: "apply", step: "prior", sub: 1, branch: null, steps: [{ id: "idea", t: "아이디어", s: "키워드로 초안", done: true, cur: false }, { id: "prior", t: "선행기술 조사", s: "유사 특허", done: false, cur: true }, { id: "<x>", t: "bad" }], subs: ["유사 특허", "구성 비교", 3], prev: "유사 특허", next: "공백 맵", title: "딸기 포장", dday: { label: "공지예외주장 기한", text: "D-40", warn: true }, api: "KIPRIS 모의 모드" } }, origin);
    expect(m?.type).toBe("agri-ip:state");
    if (m?.type !== "agri-ip:state") return;
    expect(m.state.steps.map((s) => s.id)).toEqual(["idea", "prior"]);
    expect(m.state.subs).toEqual(["유사 특허", "구성 비교"]);
    expect(m.state).toMatchObject({ mode: "apply", step: "prior", sub: 1, prev: "유사 특허", next: "공백 맵", title: "딸기 포장", dday: { text: "D-40", warn: true }, api: "KIPRIS 모의 모드" });
    expect(parseFilingMessage({ origin, data: { type: "agri-ip:state", steps: [] } }, origin)).toBeNull();
  });

  it("단계별 남은 일은 형식이 맞는 것만 4개까지", () => {
    const origin = "https://atipsum.lovable.app";
    const todo = [{ t: "명세서 빈칸 3곳 채우기", step: "draft", sub: 1 }, { t: "출원서 꼭 채울 칸 2개 넣기", step: "draft", sub: "2" }, { t: "", step: "draft", sub: 0 }, { t: "나쁜 단계", step: "<x>", sub: 0 }, { t: "넘침", step: "draft", sub: 99 }, { t: "다섯째", step: "draft", sub: 0 }];
    const m = parseFilingMessage({ origin, data: { type: "agri-ip:state", step: "draft", steps: [{ id: "draft", t: "서류 작성", s: "", done: false, cur: true, visited: true, todo }, { id: "idea", t: "아이디어", s: "", done: true, cur: false }] } }, origin);
    if (m?.type !== "agri-ip:state") throw new Error("state expected");
    expect(m.state.steps[0].todo).toEqual([{ t: "명세서 빈칸 3곳 채우기", step: "draft", sub: 1 }, { t: "출원서 꼭 채울 칸 2개 넣기", step: "draft", sub: 2 }]);
    expect(m.state.steps[0].visited).toBe(true);
    expect(m.state.steps[1]).toMatchObject({ visited: false, todo: [] });
  });

  it("메시지는 에이프 출처에서 온 아는 형식만", () => {
    const origin = "https://koat-axlab.vercel.app";
    expect(parseFilingMessage({ origin, data: { type: "agri-ip:ais", q: "10-2020-0123456" } }, origin)).toEqual({ type: "agri-ip:ais", q: "10-2020-0123456" });
    expect(parseFilingMessage({ origin: "https://evil.example", data: { type: "agri-ip:ais", q: "x" } }, origin)).toBeNull();
    expect(parseFilingMessage({ origin, data: { type: "agri-ip:other" } }, origin)).toBeNull();
    expect(parseFilingMessage({ origin, data: "string" }, origin)).toBeNull();
  });
});
