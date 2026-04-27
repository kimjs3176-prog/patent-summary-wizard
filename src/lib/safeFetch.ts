/**
 * Fetch wrapper that adds:
 *  - Per-attempt timeout via AbortController
 *  - Optional retry with exponential backoff on transient errors
 *  - Respect for an external AbortSignal (cancellation)
 *
 * Use for client-side calls to edge functions where we want to recover from
 * brief network blips and surface clear errors instead of hanging forever.
 */
export interface SafeFetchOptions extends RequestInit {
  /** Per-attempt timeout in milliseconds. Default: 30000 */
  timeoutMs?: number;
  /** Number of retry attempts after the initial request. Default: 1 */
  retries?: number;
  /** Base delay for exponential backoff. Default: 600ms */
  baseDelayMs?: number;
}

function isRetryableStatus(status: number): boolean {
  // 408 Request Timeout, 425 Too Early, 429 Too Many, 5xx
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
}

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("abort")
  );
}

export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 30000,
    retries = 1,
    baseDelayMs = 600,
    signal: externalSignal,
    ...rest
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Forward external cancellation
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onAbort);

    try {
      const res = await fetch(url, { ...rest, signal: controller.signal });

      // If a retryable status and we have attempts left, fall through to retry
      if (!res.ok && isRetryableStatus(res.status) && attempt < retries) {
        lastError = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      lastError = err;
      // External cancellation is not retryable
      if (externalSignal?.aborted) throw err;
      if (attempt === retries || !isRetryableError(err)) throw err;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
    }

    const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
    await new Promise((r) => setTimeout(r, delay));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}