# atipsum (Agri IP Summary) brand film — NOTE

16 s, 1920x1080, 30 fps, silent. Built with the motionmaxxing skill (runtime + look.py + lint.mjs). Edit `index.html`, render with `node <skill>/scripts/render.mjs index.html final.mp4` (CHROME_PATH must point to a Chrome/Chromium; as root add `--no-sandbox`).

## The one idea
A patent is a wall of claim language nobody wants to read; the product makes it a plain sentence and a score. Cover the logo and it is still the "patent text -> plain Korean -> commercialization score" film; no generic AI-summary brand owns that exact proof. Accent green = "the AI has read it" (scan line, result, score ring, ending).

## Beats (what each buys)
| frames | role | buys |
|---|---|---|
| 0-96 | hook | The viewer feels the weight of real claim-style text and the question "이 특허, 사업이 될까?"; a green scan line crosses the wall and the film cuts mid-scan |
| 96-158 | turn | One plain sentence is all you type: "저당 딸기잼 제조방법" (the app's own placeholder example) -> cursor presses 분석 -> dive into the button |
| 158-282 | proof | The result reads in plain Korean: 쉬운 요약 / 해결한 문제 / 활용 분야 |
| 282-370 | proof | The same sheet scrolls to the commercialization evaluation: 종합 78, 기술성/시장성/사업성, TRL 6/9; dive into the ring stroke, whose green becomes the ending's ground |
| 370-480 | cta | The name arrives from 3.5x, then the lockup shrinks and leaves in motion (no held end card) |

## Real vs illustrative
- Real: brand name, colours (primary green hsl 158/64/40, boot-splash gradient, dark/paper grounds), the FileText mark from the splash screen, Noto Sans KR (the app's font), the search placeholder example, the section/score vocabulary (쉬운 요약, 사업화, 기술성/시장성/사업성, TRL x/9).
- Illustrative (invented for the film, not a real patent or analysis): the claim wall text, the summary sentences, the scores 78/82/74/76 and TRL 6. Do not present as an actual analysis result.
- Not captured from the live app (it needs the backend); UI is rebuilt in HTML from the app's tokens.

## Gates (final.mp4 / index.html)
- G0 PASS: 16.00 s matches plan; audio none (not planned).
- G2 PASS: no run of >3 flat frames (one short dip ignored at 5.27 s, the dive cut).
- G3 PASS: end hold 0.00 s (ends mid-motion, intended); final shot 3.67 s = 23 % of the film.
- G5 PASS (lint.mjs). An earlier hairline-rule fail (C6) was fixed by deleting the row dividers.
- G1, G4 judged by eye on look-final/sheet.jpg: UI text >= 0.04 H (sentences 50 px, ring figure 170 px), sheet 1500 px = 0.78 W, one hero per frame (input, sheet, ring).
- Motion: mean frame diff 2.6/255, below the human band (6.8): a calm film by choice; weakest stretches are the ~0.8 s reading holds after the summary lines and the score.
- Not done: no `Motion.selfTest` result was read out (the page runs it with `?selftest` but I did not capture the console); no sound (no ElevenLabs key) — add VO/music with `references/sound-sync.md`.

## Frame descriptions (look-final/sheet.jpg)
0.5 s question rising over a dark claim wall; 1.5 s full headline, green rim on the wall; 2.5 s scan line sweeping the top; 3.5 s pale search pill with placeholder, cursor entering; 4.5 s "저당 딸기잼 제조" typed, cursor on 분석; 5.5 s dive/title "저당" arriving on a white sheet; 6.5-8.5 s summary rows reading in; 9.5 s sheet scrolled to the evaluation, ring at 0; 10.5 s ring 75 filling; 11.5 s 78 with TRL ladder; 12.5-15.5 s mark, wordmark, tagline on the brand gradient, shrinking out.

## Would still improve
Real captured app screens for the proof beats; VO + sound design; a slightly livelier middle (mean motion is low); confirm Hangul line breaks/typing cadence by eye at full speed.
