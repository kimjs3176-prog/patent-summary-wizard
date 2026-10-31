import { describe, it, expect, beforeEach } from "vitest";
import {
  csvCell, EMPTY_FINDER_FORM, FINDER_HISTORY_KEY, FINDER_HISTORY_MAX, finderFormFromParams, finderResultsCsv, finderShareParams,
  finderStage, loadFinderHistory, parseFinderHistory, pushFinderHistory, saveFinderHistory,
  type FinderForm, type FinderResult, type FinderRun,
} from "@/lib/patentFinder";

const form = (item: string, extra: Partial<FinderForm> = {}): FinderForm => ({ ...EMPTY_FINDER_FORM, industry: "식품가공", item, ...extra });
const result = (patentId: string, extra: Partial<FinderResult> = {}): FinderResult => ({
  patentId, title: `제목 ${patentId}`, applicant: "농촌진흥청", terms: ["딸기"], fit: 80, reason: "이유", matchPoints: ["원료 대체"],
  considerations: "확인", readinessMatch: null, snippet: "초록".repeat(100), thumbnail: "http://img", ...extra,
});
const runOf = (item: string, at = "2026-10-31T00:00:00.000Z", results = [result("10-1")]): FinderRun => ({
  id: item, at, form: form(item), data: { success: true, terms: ["딸기"], need: "필요", candidateCount: 40, results },
});

describe("나만의 특허찾기 최근 추천 기록", () => {
  beforeEach(() => localStorage.clear());

  it(`최신순으로 최대 ${FINDER_HISTORY_MAX}건, 같은 입력은 하나로 합친다`, () => {
    let list: FinderRun[] = [];
    for (const item of ["a1", "a2", "a3", "a4", "a5", "a6"]) list = pushFinderHistory(list, runOf(item));
    expect(list.map((r) => r.form.item)).toEqual(["a6", "a5", "a4", "a3", "a2"]);
    list = pushFinderHistory(list, runOf("a3", "2026-11-01T00:00:00.000Z"));
    expect(list.map((r) => r.form.item)).toEqual(["a3", "a6", "a5", "a4", "a2"]);
    expect(list[0].at).toBe("2026-11-01T00:00:00.000Z");
  });

  it("저장본에서 초록·이미지 같은 긴 필드는 빼고 글자 수를 제한한다", () => {
    const [saved] = pushFinderHistory([], runOf("잼", undefined, [result("10-1", { reason: "가".repeat(500) })]));
    const r = saved.data.results![0];
    expect(r.snippet).toBeUndefined();
    expect(r.thumbnail).toBeUndefined();
    expect(r.reason.length).toBe(240);
    expect(r.applicant).toBe("농촌진흥청");
  });

  it("직렬화 크기가 한도를 넘으면 오래된 기록부터 버린다(최신 1건은 유지)", () => {
    let list: FinderRun[] = [];
    const many = Array.from({ length: 12 }, (_, i) => result(`10-${i}`, { reason: "나".repeat(240) }));
    for (const item of ["a1", "a2", "a3"]) list = pushFinderHistory(list, runOf(item, undefined, many), 8_000);
    expect(list.length).toBe(1);
    expect(list[0].form.item).toBe("a3");
    expect(pushFinderHistory([], runOf("b1")).length + pushFinderHistory(list, runOf("b1")).length).toBe(3);
  });

  it("localStorage 왕복 후 같은 내용, 손상된 값은 빈 목록", () => {
    const list = pushFinderHistory([], runOf("잼"));
    expect(saveFinderHistory(list)).toBe(true);
    expect(loadFinderHistory()).toEqual(list);
    localStorage.setItem(FINDER_HISTORY_KEY, "{broken");
    expect(loadFinderHistory()).toEqual([]);
    expect(parseFinderHistory(JSON.stringify([{ id: 1 }, { id: "x", at: "t", form: { industry: "", item: "" }, data: {} }]))).toEqual([]);
  });

  it("목적·완성도 값은 허용된 것만 남긴다", () => {
    const [r] = parseFinderHistory(JSON.stringify([{ id: "1", at: "t", form: { industry: "a", item: "b", purposes: ["신제품 개발", "해킹"], readiness: "now" }, data: { success: true } }]));
    expect(r.form.purposes).toEqual(["신제품 개발"]);
    expect(r.form.readiness).toBe("any");
  });
});

describe("공유 링크는 입력만 담는다", () => {
  it("입력 → 쿼리 → 입력 왕복, run=1 포함, AI 결과는 없음", () => {
    const f = form("저당 딸기잼", { purposes: ["신제품 개발", "원가 절감"], capabilities: "살균 라인", readiness: "ready" });
    const params = finderShareParams(f);
    expect(params.get("run")).toBe("1");
    expect([...params.keys()].sort()).toEqual(["cap", "industry", "item", "purpose", "purpose", "readiness", "run"].sort());
    expect(finderFormFromParams(params)).toEqual(f);
  });

  it("입력이 없는 링크는 null", () => {
    expect(finderFormFromParams(new URLSearchParams("run=1"))).toBeNull();
  });
});

describe("결과 CSV", () => {
  it("쉼표·따옴표·줄바꿈을 RFC 4180 방식으로 감싸고, 수식처럼 보이는 값은 무력화", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("줄\n바꿈")).toBe('"줄\n바꿈"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell(null)).toBe("");
    expect(csvCell(87)).toBe("87");
  });

  it("헤더와 행을 만들고 Excel용 BOM을 붙인다", () => {
    const csv = finderResultsCsv([result("10-1", { matchPoints: ["원료 대체", "설비 활용"], reason: "맞음, 좋음" })]);
    expect(csv.startsWith("﻿순위,특허번호,발명의 명칭,보유기관,적합도,추천 이유,맞는 지점,도입 전 확인\r\n")).toBe(true);
    expect(csv).toContain('1,10-1,제목 10-1,농촌진흥청,80,"맞음, 좋음",원료 대체 / 설비 활용,확인\r\n');
  });
});

describe("진행 단계 표시", () => {
  it("경과 시간에 따라 조건 분석 → 후보 검색 → 적합도 평가", () => {
    expect([0, 3, 4, 31, 32, 95].map(finderStage)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});
