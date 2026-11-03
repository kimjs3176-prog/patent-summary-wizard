// Parsing helpers for the commercialization score JSON returned by the model.
// A cut-off or malformed answer returns null so the caller can retry instead of failing.

export function isTokenLimitFinish(finishReason: unknown): boolean {
  return typeof finishReason === "string" && /length|max_tokens|max_output_tokens/i.test(finishReason);
}

// deno-lint-ignore no-explicit-any
export function parseScoreJson(content: unknown): Record<string, any> | null {
  if (typeof content !== "string" || !content.trim()) return null;
  const candidates = [content.trim()];
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const braces = content.match(/\{[\s\S]*\}/);
  if (braces) candidates.push(braces[0]);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // try next candidate
    }
  }
  return null;
}
