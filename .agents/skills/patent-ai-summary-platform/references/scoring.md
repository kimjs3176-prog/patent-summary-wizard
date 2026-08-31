# Commercialization scoring rubric

Three axes, each 0–100, weighted into a total with a letter grade.

| Axis | What the LLM must judge |
| --- | --- |
| 기술성 | 독립항 차별성, 권리범위 넓이, 회피설계 난이도 |
| 시장성 | 대상 시장 규모/성장성, 수요 구체성, 대체 기술 존재 |
| 사업성 | 양산·인허가 난이도, 초기 투자, 수익 모델 명확성 |

## Bands and grades

Scores are constrained to **55–95** — a public-sector portfolio has no true zeros and
uncapped LLM scores drift. Grades: S ≥ 90, A ≥ 80, B ≥ 70, C otherwise.

Apply a V-RAY style correction after the raw LLM scores: value / rarity / imitability /
organization checks that nudge ±5 rather than replacing the score.

## TRL

9 steps, rendered Red→Amber→Emerald. Infer from claim maturity + presence of
실시예/실증 data. Never claim TRL ≥ 7 without explicit 실증/시작품 evidence in the text.

## Score lock (mandatory)

Persist the analysis keyed by patent number. Only recompute when
`forceRegenerate` is set. Without this the same patent scores differently between
the search list, the summary page, and the PDF.

## Retuning for a new field

- Reweight axes: hardware-heavy fields lean 사업성, 바이오 leans 기술성.
- Replace the market-size reference examples in the prompt with the new field's
  typical sources, otherwise the LLM cites agricultural statistics.
- Adjust the 55–95 clamp only if the portfolio genuinely spans wider quality.
