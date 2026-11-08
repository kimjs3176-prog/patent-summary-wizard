import { describe, expect, it } from "vitest";
import { parseIpNumber, parseIpNumberList } from "@/lib/ipNumber";
import { classifyQuery } from "@/lib/queryIntent";

const norm = (s: string) => {
  const ip = parseIpNumber(s);
  return ip ? `${ip.normalized} ${ip.isApplication ? "출원" : "등록"}` : null;
};

describe("parseIpNumber — KIPRIS 표기 그대로 붙여 넣어도 같은 번호로 읽는다", () => {
  it("reads the full registration number with its 0000 tail", () => {
    expect(norm("10-2080834-0000")).toBe("10-2080834 등록");
    expect(norm("1020808340000")).toBe("10-2080834 등록");
    expect(norm("10-1851132-0000")).toBe("10-1851132 등록");
    expect(norm("1018511320000")).toBe("10-1851132 등록");
    expect(norm("20-0412345-0000")).toBe("20-0412345 등록");
  });

  it("does not turn a 13-digit registration into a non-existent application number", () => {
    // 출원 일련번호 7자리는 늘 0으로 시작하므로 2340000·1230000 은 등록번호 뒤 0000 이다
    expect(norm("1020012340000")).toBe("10-2001234 등록");
    expect(norm("1019851230000")).toBe("10-1985123 등록");
  });

  it("keeps real application numbers, including ones that end in 0000", () => {
    expect(norm("1020190003962")).toBe("10-2019-0003962 출원");
    expect(norm("1020190030000")).toBe("10-2019-0030000 출원");
    expect(norm("10-2024-0193000")).toBe("10-2024-0193000 출원");
  });

  it("drops publication kind codes and the usual prefixes", () => {
    expect(norm("10-2080834B1")).toBe("10-2080834 등록");
    expect(norm("10-2080834 B1")).toBe("10-2080834 등록");
    expect(norm("10-2019-0003962 A")).toBe("10-2019-0003962 출원");
    expect(norm("KR10-2080834B1")).toBe("10-2080834 등록");
    expect(norm("KR10-2080834")).toBe("10-2080834 등록");
    expect(norm("제10-2080834호")).toBe("10-2080834 등록");
    expect(norm("102080834")).toBe("10-2080834 등록");
  });

  it("still treats words as keywords", () => {
    expect(parseIpNumber("5G 스마트팜")).toBeNull();
    expect(parseIpNumber("2019-스마트팜")).toBeNull();
    expect(parseIpNumber("B1")).toBeNull();
    expect(classifyQuery("10-2080834-0000")).toBe("number");
    expect(classifyQuery("1020808340000")).toBe("number");
  });

  it("dedupes one patent written two ways in a batch list", () => {
    const r = parseIpNumberList("1020808340000\n1020012340000\n10-2080834\n10-2080834-0000");
    expect(r.invalid).toEqual([]);
    expect(r.supported.map((i) => i.normalized)).toEqual(["10-2080834", "10-2001234"]);
  });
});
