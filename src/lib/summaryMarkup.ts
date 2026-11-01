/**
 * Inline markup used by AI summaries: importance bold (**…**) and Latin binomial italics (*…*).
 * The prompt asks for italics inside bold ("**`*Leuconostoc mesenteroides*` K2-4 균주**"), so a bold
 * span may contain single-star italic pairs; splitting on "no star inside bold" left those spans with
 * literal "**" on the page and in print.
 */
const BOLD_BODY = String.raw`(?:[^*\n]|\*[^*\n]+?\*)+?`;
const BOLD_SPLIT_RE = new RegExp(String.raw`(\*\*${BOLD_BODY}\*\*)`, "g");
const BOLD_RE = new RegExp(String.raw`^\*\*(${BOLD_BODY})\*\*$`);
const ITALIC_SPLIT_RE = /(\*[A-Za-z][A-Za-z0-9 .-]{1,60}\*)/g;
const ITALIC_RE = /^\*([A-Za-z][A-Za-z0-9 .-]{1,60})\*$/;

export interface MarkupSegment { text: string; bold?: boolean; italic?: boolean }

/** Split into bold / plain runs. Bold inner text keeps its italic markers for splitItalic. */
export function splitBold(text: string): MarkupSegment[] {
  if (!text) return [];
  return text.split(BOLD_SPLIT_RE).filter(Boolean).map((part) => {
    const m = part.match(BOLD_RE);
    return m ? { text: m[1], bold: true } : { text: part };
  });
}

/** Split into italic (Latin names) / plain runs. */
export function splitItalic(text: string): MarkupSegment[] {
  if (!text) return [];
  return text.split(ITALIC_SPLIT_RE).filter(Boolean).map((part) => {
    const m = part.match(ITALIC_RE);
    return m ? { text: m[1], italic: true } : { text: part };
  });
}
