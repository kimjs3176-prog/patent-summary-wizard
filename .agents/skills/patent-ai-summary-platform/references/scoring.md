# Commercialization scoring rubric

Three axes, each 0–100, weighted into a total with a letter grade.

| Axis | What the LLM must judge |
| --- | --- |
| Technology | independent-claim distinctiveness, breadth of scope, design-around difficulty |
| Market | target market size/growth, demand specificity, substitutes |
| Business | manufacturing & approval difficulty, upfront investment, revenue-model clarity |

## Bands and grades

Clamp scores to **55–95**: a curated institutional portfolio has no true zeros, and
uncapped LLM scores drift. Grades: S ≥ 90, A ≥ 80, B ≥ 70, C otherwise.

Apply a VRIO/V-RAY style correction after the raw scores — value / rarity /
imitability / organization checks that nudge ±5 rather than replacing the score.

## TRL

9 steps, rendered as a progress bar (red → amber → green). Infer from claim maturity and
the presence of worked examples or validation data. Never claim TRL ≥ 7 without explicit
prototype/field-validation evidence in the text.

## Score lock (mandatory)

Persist the analysis keyed by patent number and recompute only on explicit
regeneration. Without this, the same patent scores differently in the search list, the
summary page, and the PDF.

## Retuning for a new field

- Reweight axes: hardware-heavy fields lean Business; bio/pharma leans Technology;
  software leans Market.
- Replace the market-size reference examples in the prompt with the new field's typical
  statistical sources, otherwise the model cites the previous domain's statistics.
- Adjust the 55–95 clamp only if the portfolio genuinely spans wider quality.
- Keep the schema for structured output small and unconstrained; state numeric limits in
  the prompt and clamp in code, not in the schema.
