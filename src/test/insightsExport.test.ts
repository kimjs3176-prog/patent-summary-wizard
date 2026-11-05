import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { aggregateTrends } from "../../supabase/functions/filing-trends/trendAggregation";
import type { TrendSnapshot } from "@/hooks/useFilingTrends";
import {
  buildInsightsTables, combinedCsvRows, csvCell, exportFileName, instituteRows, PROVISIONAL_MONTH_LABEL, snapshotNote, tableToAoa, toCsv,
} from "@/components/insights/insightsExport";

const now = new Date(Date.UTC(2026, 9, 24)); // 2026-10-24 → 기준연도 2024
const f = (number: string, date: string, applicant = "농촌진흥청", ipc = "A23L 2/00") => ({ number, date, applicant, ipc, title: "제목" });
const filings = [
  ...Array.from({ length: 6 }, (_, i) => f(`10202300000${10 + i}`, "20230310")),
  ...Array.from({ length: 9 }, (_, i) => f(`10202400000${10 + i}`, "20240310")),
  f("1020240000099", "20240311", "경기도농업기술원", "A01G 9/00"),
  f("1020250000001", "20250610", "국립종자원", "A01H 5/00"),
];
const snapshot: TrendSnapshot = { ...aggregateTrends(filings, now), insights: [], updatedAt: "2026-10-24T01:00:00.000Z" };

describe("기관별 출원 순위", () => {
  it("누적 많은 순으로 순위를 매기고 기준연도·전년 대비 증감률을 붙인다", () => {
    const rows = instituteRows(snapshot);
    expect(rows.map((r) => [r.rank, r.id, r.total, r.latest, r.previous])).toEqual([
      [1, "rda", 15, 9, 6],
      [2, "ares", 1, 1, 0],
      [3, "seed", 1, 0, 0],
    ]);
    expect(rows[0].growth).toBe(50);
  });

  it("전년이 0건이거나 5건 미만이면 증감률은 null (서버 growthRate 규칙과 동일)", () => {
    const base = { label: "x", total: 10 };
    const rows = instituteRows({
      institutes: [
        { ...base, id: "rda", latest: 7, previous: 0 },
        { ...base, id: "qia", latest: 0, previous: 0 },
        { ...base, id: "seed", latest: 3, previous: 4 },
        { ...base, id: "naqs", latest: 0, previous: 5 },
      ],
    });
    expect(rows.map((r) => r.growth)).toEqual([null, null, null, -100]);
  });
});

describe("인사이트 데이터 내려받기 표", () => {
  const tables = buildInsightsTables(snapshot);
  const byName = Object.fromEntries(tables.map((t) => [t.name, t]));

  it("연도별·분야별·기관별·월별 표 4개를 만든다", () => {
    expect(tables.map((t) => t.name)).toEqual(["연도별 출원", "기술 분야별 순위", "기관별 출원", "월별 출원 추이"]);
    for (const t of tables) {
      expect(t.name.length).toBeLessThanOrEqual(31);
      expect(t.rows.every((r) => r.length === t.header.length)).toBe(true);
      expect(t.widths.length).toBe(t.header.length);
    }
  });

  it("연도별 표는 서버의 잠정 표시를 그대로 따른다", () => {
    const rows = byName["연도별 출원"].rows;
    expect(rows.find((r) => r[0] === 2024)).toEqual([2024, 10, 10, 0, "확정"]);
    expect(rows.find((r) => r[0] === 2025)?.[4]).toBe("잠정(공개 진행 중)");
  });

  it("분야별 표는 기준연도 출원 많은 순이며 증감률이 없으면 빈칸", () => {
    const t = byName["기술 분야별 순위"];
    expect(t.header.slice(2, 4)).toEqual(["2024년 출원(건)", "2023년 출원(건)"]);
    expect(t.header).toContain("2025년(잠정)");
    expect(t.rows[0].slice(0, 6)).toEqual([1, "식품", 9, 6, 50, 90]);
    expect(t.rows.find((r) => r[1] === "재배")?.[4]).toBe("");
  });

  it("월별 표는 공개 지연으로 덜 집계된 달을 표시한다", () => {
    const rows = byName["월별 출원 추이"].rows;
    expect(rows).toHaveLength(24);
    expect(rows[0][0]).toBe("2024-11");
    const provisional = snapshot.monthly.filter((m) => m.provisional).length;
    expect(rows.filter((r) => r[2] === PROVISIONAL_MONTH_LABEL)).toHaveLength(provisional);
  });

  it("머리글에 집계 기간과 기준연도를 적는다", () => {
    const note = snapshotNote(snapshot);
    expect(note[1]).toContain("2020.01.01~2026.10.24");
    expect(note[1]).toContain("기준연도 2024년");
    expect(note[1]).toContain("2025.04.24까지 출원분 공개 완료");
    const aoa = tableToAoa(byName["기관별 출원"], note);
    expect(aoa[2]).toEqual([]);
    expect(aoa[3][0]).toBe("순위");
    expect(exportFileName(snapshot, "기관별 출원", "csv")).toBe("농식품_특허출원동향_2024년기준_기관별출원.csv");
  });

  it("XLSX 시트로 써도 값이 그대로 남는다", () => {
    const wb = XLSX.utils.book_new();
    for (const t of tables) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tableToAoa(t, snapshotNote(snapshot))), t.name);
    const back = XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { type: "array" });
    expect(back.SheetNames).toEqual(tables.map((t) => t.name));
    const rows = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets["기관별 출원"], { header: 1 });
    expect(rows[4]).toEqual([1, "농촌진흥청", 15, 9, 6, 50]);
  });
});

describe("CSV 만들기", () => {
  it("쉼표·따옴표·줄바꿈을 RFC 4180 규칙으로 감싼다", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("줄\n바꿈")).toBe('"줄\n바꿈"');
    expect(csvCell(12)).toBe("12");
    expect(csvCell(-10)).toBe("-10");
    expect(csvCell("")).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("수식으로 해석될 수 있는 글자는 무력화한다", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-5")).toBe("-5");
  });

  it("UTF-8 BOM과 CRLF 줄바꿈을 쓴다", () => {
    const csv = toCsv([["기관", "출원"], ["농촌진흥청", 3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿기관,출원\r\n농촌진흥청,3\r\n");
  });

  it("엑셀을 못 쓸 때는 모든 표를 CSV 하나에 이어 붙인다", () => {
    const tables = buildInsightsTables(snapshot);
    const rows = combinedCsvRows(tables, ["머리글"]);
    expect(rows[0]).toEqual(["머리글"]);
    expect(rows.filter((r) => typeof r[0] === "string" && /^\[.+\]$/.test(r[0] as string)).map((r) => r[0])).toEqual(tables.map((t) => `[${t.name}]`));
  });
});
