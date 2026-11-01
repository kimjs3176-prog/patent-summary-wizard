import { describe, it, expect } from "vitest";
import {
  AI_ESTIMATE_NOTE,
  analyzeMarketScopes,
  claimToRef,
  extractGlobalClaims,
  extractMarketClaims,
  MAX_STORED_CAGR,
  reconcileMarketSection,
} from "../../supabase/functions/summarize-patent/marketConsistency";
import { MARKET_GOLDEN } from "./fixtures/marketGolden";

const FIGURE = /\d[\d,]*(?:\.\d+)?\s*(?:조|억|천만|백만|만)\s*원|USD\s*\d|\d+(?:\.\d+)?\s*%/;

describe("관련시장 동향 골든 케이스", () => {
  for (const c of MARKET_GOLDEN) {
    describe(c.name, () => {
      const out = reconcileMarketSection(c.section, c.refs, { targetYear: c.targetYear });

      it("사례별 기대 문구", () => {
        for (const s of c.contains ?? []) expect(out).toContain(s);
        for (const s of c.notContains ?? []) expect(out).not.toContain(s);
      });

      it("양(+)의 CAGR이면 어떤 시장도 기준값이 이후 연도 값보다 크지 않다", () => {
        for (const kind of ["domestic", "global"] as const) {
          for (const s of analyzeMarketScopes(out, kind, c.targetYear)) {
            const cagrs = [...new Set(s.cagrs.filter((x) => !x.ambiguous && x.hi == null).map((x) => x.lo))];
            if (!s.base || cagrs.length !== 1 || !(cagrs[0] > 0)) continue;
            for (const p of s.pairs) if (p.year > s.base.year) expect(p.lo, `${s.label.text} ${p.year}`).toBeGreaterThanOrEqual(s.base.lo);
          }
        }
      });

      it("수치가 있는 문장은 모두 공식 출처 또는 (AI 추정치)를 단다", () => {
        const sentences = out.split(/(?<=[.。])\s+/).filter((x) => FIGURE.test(x));
        expect(sentences.length).toBeGreaterThan(0);
        for (const s of sentences) expect(s, s).toMatch(/\((?:출처: [^()]+?)?(?:; )?(?:AI 추정치)?\)\.?$/);
        for (const s of sentences) if (!s.includes("(출처:")) expect(s).toContain(AI_ESTIMATE_NOTE);
      });

      it("30% 초과 CAGR은 표준값으로 저장되지 않는다", () => {
        const claims = [...extractMarketClaims(c.section, c.targetYear), ...extractGlobalClaims(c.section, c.targetYear)];
        for (const cl of claims) {
          const ref = claimToRef(cl);
          if (ref) expect(ref.cagr).toBeLessThanOrEqual(MAX_STORED_CAGR);
          if (cl.cagr != null && cl.cagr > MAX_STORED_CAGR) expect(ref).toBeNull();
          if (ref) expect(ref.source ?? null).toBeNull();
        }
      });

      it("반복 적용해도 결과가 같다(캐시 재보정)", () => {
        expect(reconcileMarketSection(out, c.refs, { targetYear: c.targetYear })).toBe(out);
      });
    });
  }
});
