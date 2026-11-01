/**
 * Structured logging for edge functions: every call prints ONE JSON line
 * `{ts, level, fn, event, reqId, ...fields}` so logs can be filtered by function,
 * event and request. Field values are sanitized before printing:
 *  - keys that look like credentials (key/token/secret/password/authorization) are redacted,
 *  - credential-looking query parameters and bearer tokens inside strings are masked,
 *  - long strings are truncated (≤ MAX_STRING chars) and deep/large structures are bounded,
 * so upstream payloads (e.g. raw KIPRIS XML) never end up in the logs.
 *
 * Pure module (no Deno-only APIs) so it can be unit-tested with vitest.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export const MAX_STRING = 300;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const REDACTED = "[REDACTED]";

/** Credential-like keys. `keyword(s)` is a search term, not a key, so it is exempt. */
const SENSITIVE_KEY = /key(?!words?)|token|secret|password|authorization/i;
/** `ServiceKey=…`, `accessKey=…`, `api_key=…`, `token=…` inside URLs or messages. */
const SENSITIVE_PARAM = /\b([A-Za-z_]*(?:key|token|secret|password)[A-Za-z_]*)=([^&\s"']+)/gi;
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;

export function truncate(value: string, max = MAX_STRING): string {
  if (value.length <= max) return value;
  const suffix = `…(+${value.length - max} chars)`;
  return value.slice(0, Math.max(0, max - suffix.length)) + suffix;
}

function scrubString(value: string): string {
  const masked = value
    .replace(SENSITIVE_PARAM, (_m, name: string) => `${name}=***`)
    .replace(BEARER, "$1 ***");
  return truncate(masked);
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message) };
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return scrubString(String(value));
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `[Array(${value.length})]` : "[Object]";
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`…(+${value.length - MAX_ARRAY_ITEMS} items)`);
    return items;
  }
  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, inner] of entries.slice(0, MAX_OBJECT_KEYS)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(inner, depth + 1, seen);
  }
  if (entries.length > MAX_OBJECT_KEYS) out["…"] = `+${entries.length - MAX_OBJECT_KEYS} keys`;
  return out;
}

/** Redacts credential-like keys, masks secrets in strings and bounds sizes. */
export function sanitizeFields(fields: LogFields = {}): LogFields {
  return sanitizeValue(fields, 0, new WeakSet()) as LogFields;
}

export function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 16);
  return Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-8);
}

/** Reuses an incoming `x-request-id` (sanitized, ≤64 chars) or creates a new one. */
export function requestIdFrom(source?: Request | Headers | null): string {
  const headers = source instanceof Headers ? source : source?.headers;
  const incoming = headers?.get("x-request-id")?.trim();
  if (incoming && /^[A-Za-z0-9._:-]{1,64}$/.test(incoming)) return incoming;
  return newRequestId();
}

/** Builds the single-line JSON record (exported for tests). */
export function formatLog(level: LogLevel, event: string, fields: LogFields = {}, now: Date = new Date()): string {
  const { fn, reqId, ...rest } = sanitizeFields(fields);
  // Fields may not override the envelope keys.
  for (const reserved of ["ts", "level", "event"]) delete rest[reserved];
  return JSON.stringify({ ts: now.toISOString(), level, fn: fn ?? null, event, reqId: reqId ?? null, ...rest });
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = formatLog(level, event, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface RequestLogger {
  readonly fn: string;
  readonly reqId: string;
  /** Milliseconds since the logger was created (request start). */
  elapsed(): number;
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** Logs `request.end` with the response status and total duration. */
  end(status: number, fields?: LogFields): void;
}

/**
 * Per-request logger bound to a function name and request id. Logs `request.start`
 * immediately (with the HTTP method) unless `logStart` is false.
 */
export function createRequestLogger(fn: string, req?: Request | null, { logStart = true } = {}): RequestLogger {
  const reqId = requestIdFrom(req);
  const startedAt = Date.now();
  const emit = (level: LogLevel) => (event: string, fields: LogFields = {}) =>
    log(level, event, { ...fields, fn, reqId });
  const logger: RequestLogger = {
    fn,
    reqId,
    elapsed: () => Date.now() - startedAt,
    debug: emit("debug"),
    info: emit("info"),
    warn: emit("warn"),
    error: emit("error"),
    end(status, fields = {}) {
      const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      log(level, "request.end", { ...fields, status, durationMs: Date.now() - startedAt, fn, reqId });
    },
  };
  if (logStart) logger.info("request.start", { method: req?.method });
  return logger;
}

/**
 * Wraps a `serve` handler: logs `request.start`, then `request.end` with the status and
 * duration (time until the Response is returned, i.e. time-to-first-byte for streams),
 * logs unhandled errors, and echoes the request id in an `x-request-id` response header.
 * CORS preflights pass through without logging.
 */
export function withRequestLog(
  fn: string,
  handler: (req: Request, logger: RequestLogger) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const preflight = req.method === "OPTIONS";
    const logger = createRequestLogger(fn, req, { logStart: !preflight });
    if (preflight) return handler(req, logger);
    try {
      const res = await handler(req, logger);
      logger.end(res.status);
      try {
        res.headers.set("x-request-id", logger.reqId);
      } catch {
        // Immutable headers (e.g. a proxied upstream Response): skip the echo.
      }
      return res;
    } catch (error) {
      logger.error("request.unhandled", { error });
      logger.end(500);
      throw error;
    }
  };
}
