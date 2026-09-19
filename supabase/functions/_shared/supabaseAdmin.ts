import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client shared by every edge function.
 * Cached at module scope so warm invocations reuse the same instance.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured");
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
