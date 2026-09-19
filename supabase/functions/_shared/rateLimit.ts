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

/** Derive a caller identity: authenticated user id when present, otherwise client IP. */
function callerIdentity(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (token && token.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload?.sub && payload.role !== "anon") return `user:${payload.sub}`;
    } catch {
      // fall through to IP
    }
  }
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return `ip:${ip}`;
}

/**
 * Returns a 429 Response when the caller exceeded the quota, otherwise null.
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
    return null;
  } catch (err) {
    console.warn("[rateLimit] unexpected error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
