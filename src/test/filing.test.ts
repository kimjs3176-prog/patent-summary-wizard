import { describe, it, expect } from "vitest";
import {
  FILING_DEFAULT_URL,
  buildFilingSrc,
  buildFilingStandaloneUrl,
  filingBaseUrl,
  filingEnabled,
  filingFieldFromIpc,
  ideaKeywordsFromTitle,
  normalizeFilingPage,
  sendPatentToFiling,
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

  it("AI 분석 중 표시는 문자열만, 길이를 잘라 받는다", () => {
    const origin = "https://atipsum.lovable.app";
    const base = { type: "agri-ip:state", step: "diag", steps: [{ id: "diag", t: "진단·보완", s: "", done: false, cur: true }] };
    const busy = parseFilingMessage({ origin, data: { ...base, aiBusy: "거절이유 예상" } }, origin);
    const idle = parseFilingMessage({ origin, data: { ...base, aiBusy: 1 } }, origin);
    if (busy?.type !== "agri-ip:state" || idle?.type !== "agri-ip:state") throw new Error("state expected");
    expect(busy.state.aiBusy).toBe("거절이유 예상");
    expect(idle.state.aiBusy).toBe("");
  });

  it("메시지는 에이프 출처에서 온 아는 형식만", () => {
    const origin = "https://koat-axlab.vercel.app";
    expect(parseFilingMessage({ origin, data: { type: "agri-ip:ais", q: "10-2020-0123456" } }, origin)).toEqual({ type: "agri-ip:ais", q: "10-2020-0123456" });
    expect(parseFilingMessage({ origin: "https://evil.example", data: { type: "agri-ip:ais", q: "x" } }, origin)).toBeNull();
    expect(parseFilingMessage({ origin, data: { type: "agri-ip:other" } }, origin)).toBeNull();
    expect(parseFilingMessage({ origin, data: "string" }, origin)).toBeNull();
  });

  it("요약 화면의 '이 기술로 출원 준비': 비교 특허와 키워드·분야를 함께 넘기면 1단계에서 새 아이디어로 시작", () => {
    expect(buildFilingSrc({}, { cite: "10-2017-0078319", title: "콩 들불병", kw: "콩, 들불병, 진단", field: "variety" })).toBe(
      `${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#idea?cite=1020170078319&title=%EC%BD%A9+%EB%93%A4%EB%B6%88%EB%B3%91&kw=%EC%BD%A9%2C+%EB%93%A4%EB%B6%88%EB%B3%91%2C+%EC%A7%84%EB%8B%A8&field=variety`,
    );
    // 키워드가 없으면 예전처럼 선행기술 조사에 비교 특허만
    expect(buildFilingSrc({}, { cite: "10-2017-0078319", kw: "  " })).toBe(`${FILING_DEFAULT_URL}?embed=ais&skin=ais&theme=light#prior?cite=1020170078319`);
    expect(sendPatentToFiling({}, "10-2017-0078319", "콩 들불병", { kw: " 콩, 진단 ", field: "variety" })).toEqual({ sent: false, to: "/filing?cite=1020170078319&title=%EC%BD%A9+%EB%93%A4%EB%B6%88%EB%B3%91&kw=%EC%BD%A9%2C+%EC%A7%84%EB%8B%A8&field=variety" });
    expect(sendPatentToFiling({}, "1020170078319", "x")).toEqual({ sent: false, to: "/filing?cite=1020170078319&title=x" });
  });

  it("특허분류(IPC)로 출원지원 기술 분야를 고른다", () => {
    expect(filingFieldFromIpc(["C12Q 1/68"])).toBe("variety");
    expect(filingFieldFromIpc(["A01N63/22", "C05F 11/08"])).toBe("ferment");
    expect(filingFieldFromIpc(["A23L 33/105"])).toBe("functional");
    expect(filingFieldFromIpc(["A23L 5/00"])).toBe("food");
    expect(filingFieldFromIpc(["A01G 9/24"])).toBe("smartfarm");
    expect(filingFieldFromIpc(["B65D 81/24"])).toBe("pack");
    expect(filingFieldFromIpc(["H01L 21/00", "A23B 7/148"])).toBe("pack");
    expect(filingFieldFromIpc(["H01L 21/00"])).toBeUndefined();
    expect(filingFieldFromIpc()).toBeUndefined();
  });

  it("특허 명칭에서 아이디어 키워드(원료·방식·용도)를 뽑는다", () => {
    expect(ideaKeywordsFromTitle("미생물 발효 유채박을 유효성분으로 함유하는 식물 생장 촉진용 조성물 및 이를 이용한 식물 생장 촉진 방법", "ferment")).toBe("유채박, 미생물 발효, 식물 생장 촉진");
    expect(ideaKeywordsFromTitle("콩 들불병 진단용 조성물 및 이의 용도", "variety")).toBe("콩, 들불병, 진단");
    expect(ideaKeywordsFromTitle("하이네코사인을 유효성분으로 포함하는 식물 생장 촉진용 조성물", "ferment")).toBe("하이네코사인, 발효, 식물 생장 촉진");
    expect(ideaKeywordsFromTitle("여주 추출물을 포함하는 혈당 조절용 건강기능식품", "functional")).toBe("여주, 혈당 조절, 부산물");
    expect(ideaKeywordsFromTitle("영상 분석을 이용한 작물 생육 관리 방법", "smartfarm")).toBe("영상 분석, 자동 제어, 작물 생육 관리");
    expect(ideaKeywordsFromTitle("스마트 온실", "smartfarm")).toBe("");
  });
});
