import { useEffect, useState } from "react";

const CACHE_PREFIX = "auto-glossary:v1:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = { at: number; glossary: Record<string, string> };

function readCache(key: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.glossary || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed.glossary;
  } catch { return null; }
}

function writeCache(key: string, glossary: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), glossary } satisfies CacheEntry));
  } catch { /* ignore quota */ }
}

/**
 * Fetches AI-extracted glossary terms for a given patent summary.
 * Caches per-patent in localStorage (7 day TTL). No-ops while streaming or disabled.
 */
export function useAutoGlossary(
  patentNumber: string | undefined,
  content: string | undefined,
  isStreaming: boolean,
  enabled: boolean,
  title?: string,
): Record<string, string> {
  const [glossary, setGlossary] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled || !patentNumber || !content || isStreaming) return;
    if (content.trim().length < 200) return;

    const cached = readCache(patentNumber);
    if (cached) { setGlossary(cached); return; }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-glossary`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ content, title }),
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.success || !data?.glossary) return;
        writeCache(patentNumber, data.glossary);
        setGlossary(data.glossary);
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [enabled, patentNumber, content, isStreaming, title]);

  return glossary;
}