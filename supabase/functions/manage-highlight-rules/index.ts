import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const hashPassword = async (password: string) => {
  const encoded = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    const { action, password, id, status, ids } = body ?? {};

    // Verify admin password
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    const { data: cred } = await supabase
      .from("admin_credentials").select("password_hash").eq("id", 1).maybeSingle();
    const submitted = typeof password === "string" ? password : "";
    const submittedHash = submitted ? await hashPassword(submitted) : "";
    const ok = cred?.password_hash
      ? submittedHash === cred.password_hash
      : !!adminPassword && submitted === adminPassword;
    if (!ok) return new Response(JSON.stringify({ success: false, error: "인증 실패" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (action === "list") {
      const { data, error } = await supabase
        .from("highlight_rule_proposals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, rules: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-status") {
      if (!id || !["approved", "rejected", "pending"].includes(status)) {
        return new Response(JSON.stringify({ success: false, error: "잘못된 요청" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase
        .from("highlight_rule_proposals")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);
      if (targetIds.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "id 필요" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase
        .from("highlight_rule_proposals").delete().in("id", targetIds);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "알 수 없는 액션" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});