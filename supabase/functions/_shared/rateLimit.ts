import { supabaseAdmin } from "./supabaseAdmin.ts";
import { corsHeaders } from "./cors.ts";

export interface RateLimitOptions {
  /** Logical bucket name, usually the function name. */
  bucket: string;
  /** Maximum number of requests allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Derive the caller identity from the client IP only.
 *
 * The service has no signed-in users, so a JWT `sub` is never a legitimate
 * identity here; trusting an unverified token payload let callers mint a fresh
 * bucket per request. The IP is taken from headers the edge gateway sets
 * (Cloudflare's `cf-connecting-ip` cannot be overridden by the client), then
 * the LAST `x-forwarded-for` entry (appended by the trusted proxy), never the
 * first one, which the client controls.
 */
export function callerIdentity(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return `ip:${cf}`;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return `ip:${real}`;
  const fwd = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (fwd.length > 0) return `ip:${fwd[fwd.length - 1]}`;
  return "ip:unknown";
}

function tooManyRequests(opts: RateLimitOptions): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      code: "rate_limited",
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(opts.windowSeconds),
      },
    },
  );
}

/**
 * Counts this request against the bucket and returns a 429 Response when the
 * caller exceeded the quota, otherwise null.
 * Fails open (returns null) if the limiter itself errors, so a limiter outage
 * never takes the service down.
 */
export async function enforceRateLimit(req: Request, opts: RateLimitOptions): Promise<Response | null> {
  try {
    const identifier = callerIdentity(req);
    const { data, error } = await supabaseAdmin().rpc("check_rate_limit", {
      _bucket: opts.bucket,
      _identifier: identifier,
      _limit: opts.limit,
      _window_seconds: opts.windowSeconds,
    });
    if (error) {
      console.warn(`[rateLimit] check failed for ${opts.bucket}:`, error.message);
      return null;
    }
    if (data === false) {
      console.warn(`[rateLimit] blocked ${identifier} on ${opts.bucket}`);
      return tooManyRequests(opts);
    }
    return null;
  } catch (err) {
    console.warn("[rateLimit] unexpected error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Checks a bucket WITHOUT counting this request (e.g. "has this IP failed admin
 * login too often?"). Returns a 429 Response when the bucket is exhausted.
 */
export async function peekRateLimit(req: Request, opts: RateLimitOptions): Promise<Response | null> {
  try {
    const identifier = callerIdentity(req);
    const { data, error } = await supabaseAdmin().rpc("peek_rate_limit", {
      _bucket: opts.bucket,
      _identifier: identifier,
      _limit: opts.limit,
      _window_seconds: opts.windowSeconds,
    });
    if (error) {
      console.warn(`[rateLimit] peek failed for ${opts.bucket}:`, error.message);
      return null;
    }
    if (data === false) {
      console.warn(`[rateLimit] blocked (peek) ${identifier} on ${opts.bucket}`);
      return tooManyRequests(opts);
    }
    return null;
  } catch (err) {
    console.warn("[rateLimit] unexpected peek error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Records one hit in a bucket (e.g. a failed admin login) without evaluating it. */
export async function recordRateLimitHit(req: Request, opts: RateLimitOptions): Promise<void> {
  try {
    await supabaseAdmin().rpc("check_rate_limit", {
      _bucket: opts.bucket,
      _identifier: callerIdentity(req),
      _limit: opts.limit,
      _window_seconds: opts.windowSeconds,
    });
  } catch (err) {
    console.warn("[rateLimit] record failed:", err instanceof Error ? err.message : String(err));
  }
}
