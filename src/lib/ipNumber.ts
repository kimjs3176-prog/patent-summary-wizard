/**
 * 지식재산권 번호 판별 유틸
 * 특허(10) / 실용신안(20) / 디자인(30) / 상표(40) 출원·등록번호를
 * 자연어 키워드와 구분하고, 조회용으로 정규화한다.
 */

export type IpNumberKind = "patent" | "utility" | "design" | "trademark";

export interface IpNumberInfo {
  kind: IpNumberKind;
  /** 10 | 20 | 30 | 40 */
  prefix: string;
  /** 출원번호 여부 (연도 포함) */
  isApplication: boolean;
  /** 표시/조회용 정규화 번호 (예: 20-2019-0003962) */
  normalized: string;
  /** 숫자만 (예: 2020190003962) */
  digits: string;
  /** 특허/실용신안만 KIPRIS 상세조회 지원 */
  supported: boolean;
}

const KIND_BY_PREFIX: Record<string, IpNumberKind> = {
  "10": "patent",
  "20": "utility",
  "30": "design",
  "40": "trademark",
};

export const IP_KIND_LABEL: Record<IpNumberKind, string> = {
  patent: "특허",
  utility: "실용신안",
  design: "디자인",
  trademark: "상표",
};

function build(prefix: string, rest: string, isApplication: boolean): IpNumberInfo {
  const kind = KIND_BY_PREFIX[prefix];
  const normalized = isApplication
    ? `${prefix}-${rest.slice(0, 4)}-${rest.slice(4)}`
    : `${prefix}-${rest}`;
  return {
    kind,
    prefix,
    isApplication,
    normalized,
    digits: `${prefix}${rest}`,
    supported: prefix === "10" || prefix === "20",
  };
}

/**
 * 입력 문자열이 IP 번호이면 정보를 반환하고, 아니면 null(=키워드 검색 대상)을 반환한다.
 */
export function parseIpNumber(input: string): IpNumberInfo | null {
  if (!input) return null;

  // "제 10-2024-0080354 호", "KR 10-2024-0080354", 전각/유사 하이픈 정리
  const cleaned = input
    .trim()
    .replace(/[‐-‒–—―ー]/g, "-")
    .replace(/^제\s*/, "")
    .replace(/\s*호$/, "")
    .replace(/^KR\s*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  if (!/^[0-9-]+$/.test(cleaned)) return null;

  // 1) 하이픈 포함: XX-YYYY-NNNNNNN (출원) / XX-NNNNNNN (등록)
  const dashedApp = cleaned.match(/^(10|20|30|40)-(\d{4})-(\d{5,7})$/);
  if (dashedApp) {
    const [, prefix, year, serial] = dashedApp;
    if (!isPlausibleYear(year)) return null;
    return build(prefix, `${year}${serial.padStart(7, "0")}`, true);
  }

  const dashedReg = cleaned.match(/^(10|20|30|40)-(\d{5,7})$/);
  if (dashedReg) {
    const [, prefix, serial] = dashedReg;
    return build(prefix, serial.padStart(7, "0"), false);
  }

  // 하이픈이 남아 있는데 위 패턴이 아니면 번호가 아님 (예: 2019-스마트팜)
  if (cleaned.includes("-")) return null;

  const digits = cleaned;

  // 2) 13자리: XX + YYYY + 7자리 → 출원번호
  if (digits.length === 13 && KIND_BY_PREFIX[digits.slice(0, 2)]) {
    const year = digits.slice(2, 6);
    if (isPlausibleYear(year)) return build(digits.slice(0, 2), digits.slice(2), true);
  }

  // 3) 11자리: YYYY + 7자리 → 특허 출원번호로 간주
  if (digits.length === 11 && isPlausibleYear(digits.slice(0, 4))) {
    return build("10", digits, true);
  }

  // 4) 9자리: XX + 7자리 → 등록번호
  if (digits.length === 9 && KIND_BY_PREFIX[digits.slice(0, 2)]) {
    return build(digits.slice(0, 2), digits.slice(2), false);
  }

  // 5) 7자리: 특허 등록번호 본체
  if (digits.length === 7) return build("10", digits, false);

  return null;
}

function isPlausibleYear(year: string): boolean {
  const n = Number(year);
  return n >= 1948 && n <= new Date().getFullYear() + 1;
}

export interface IpNumberListResult {
  /** 특허·실용신안 등 조회 가능한 번호 (중복 제거) */
  supported: IpNumberInfo[];
  /** 번호 형식이지만 지원하지 않는 권리 (디자인·상표) */
  unsupported: IpNumberInfo[];
  /** 번호로 해석되지 않은 토큰 */
  invalid: string[];
}

/**
 * 여러 출원/등록번호가 섞인 문자열을 토큰으로 분리해 일괄 판별한다.
 * 구분자: 줄바꿈, 쉼표, 세미콜론, 슬래시, 공백, 탭
 */
export function parseIpNumberList(input: string): IpNumberListResult {
  const tokens = (input || "")
    .split(/[\n\r,;/|\t]+|\s{1,}/)
    .map((t) => t.trim())
    .filter(Boolean);

  const supported: IpNumberInfo[] = [];
  const unsupported: IpNumberInfo[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const ip = parseIpNumber(token);
    if (!ip) {
      invalid.push(token);
      continue;
    }
    if (seen.has(ip.digits)) continue;
    seen.add(ip.digits);
    (ip.supported ? supported : unsupported).push(ip);
  }

  return { supported, unsupported, invalid };
}

/** 입력이 2건 이상의 번호로만 구성되어 있으면 true (일괄조회 대상) */
export function isBatchNumberInput(input: string): boolean {
  const { supported, unsupported, invalid } = parseIpNumberList(input);
  return invalid.length === 0 && supported.length + unsupported.length >= 2;
}
