/** Shared fetch helpers: per-attempt timeout + retry with exponential backoff. */

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isRetryableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("abort") ||
    m.includes("timeout") ||
    m.includes("connection") ||
    m.includes("econnreset") ||
    m.includes("network") ||
    m.includes("stream")
  );
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { retries = 2, timeoutMs = 12000, baseDelay = 700 } = {},
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, init, timeoutMs);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === retries || !isRetryableError(lastError.message)) break;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
  throw lastError ?? new Error(`Request to ${url} failed`);
}
