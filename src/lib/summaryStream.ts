/**
 * Pure helpers for the summarize-patent SSE stream, kept free of React so the
 * parsing rules can be unit-tested. The server sends `data: <json>` lines:
 *   { choices: [{ delta: { content } }] }  incremental text
 *   { final_content }                      post-processed replacement of the whole text
 *   { meta: { ... } }                      generation metadata (model, cache, time)
 *   { error, message }                     server-side failure
 *   [DONE]                                 end of stream
 */

export interface SummaryMeta {
  /** Model identifier the server actually used (e.g. google/gemini-3.8-flash). */
  model?: string;
  /** True when the text was served from the server cache instead of generated now. */
  cached?: boolean;
  /** ISO timestamp of when the text was generated. */
  generatedAt?: string;
  /** Prompt/policy version the text was generated under. */
  promptVersion?: string;
  /** True when the market section had to fall back to the standard reference paragraph. */
  marketFallback?: boolean;
}

export type StreamFrame =
  | { type: "delta"; content: string }
  | { type: "final"; content: string }
  | { type: "meta"; meta: SummaryMeta }
  | { type: "error"; message: string }
  | { type: "done" }
  | { type: "skip" };

/** Splits a buffer into complete lines; the remainder (no trailing newline yet) is returned as `rest`. */
export function splitSseBuffer(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts, rest };
}

/** Interprets one SSE line. Malformed JSON is skipped (never re-queued: the line is already complete). */
export function parseSseLine(rawLine: string): StreamFrame {
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  if (line.startsWith(":") || line.trim() === "") return { type: "skip" };
  if (!line.startsWith("data:")) return { type: "skip" };
  const payload = line.slice(5).trim();
  if (payload === "[DONE]") return { type: "done" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { type: "skip" };
  }
  if (!parsed || typeof parsed !== "object") return { type: "skip" };
  const obj = parsed as Record<string, unknown>;
  if (obj.meta && typeof obj.meta === "object") {
    const frame: StreamFrame = { type: "meta", meta: normalizeMeta(obj.meta as Record<string, unknown>) };
    // A final frame may carry meta alongside the replacement text; meta is applied by the caller first.
    if (typeof obj.final_content !== "string") return frame;
  }
  if (typeof obj.error === "string") {
    return { type: "error", message: typeof obj.message === "string" && obj.message ? obj.message : "요약 생성 중 오류가 발생했습니다." };
  }
  if (typeof obj.final_content === "string" && obj.final_content.length > 0) {
    return { type: "final", content: obj.final_content };
  }
  const choices = obj.choices;
  if (Array.isArray(choices)) {
    const delta = (choices[0] as { delta?: { content?: unknown } } | undefined)?.delta?.content;
    if (typeof delta === "string" && delta) return { type: "delta", content: delta };
  }
  return { type: "skip" };
}

export function normalizeMeta(raw: Record<string, unknown>): SummaryMeta {
  const meta: SummaryMeta = {};
  if (typeof raw.model === "string") meta.model = raw.model;
  if (typeof raw.cached === "boolean") meta.cached = raw.cached;
  if (typeof raw.generatedAt === "string") meta.generatedAt = raw.generatedAt;
  if (typeof raw.promptVersion === "string") meta.promptVersion = raw.promptVersion;
  if (typeof raw.marketFallback === "boolean") meta.marketFallback = raw.marketFallback;
  return meta;
}

/** Extracts meta from a final frame payload when both are present (the parser returns the meta frame first). */
export function metaFromPayload(rawLine: string): SummaryMeta | null {
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  if (!line.startsWith("data:")) return null;
  try {
    const obj = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
    return obj && typeof obj.meta === "object" && obj.meta ? normalizeMeta(obj.meta as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
