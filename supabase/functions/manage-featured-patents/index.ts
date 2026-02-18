import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, password, data } = body;

    // Verify admin password
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || password !== adminPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "인증 실패" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action
    const validActions = ["list", "create", "update", "delete"];
    if (!action || !validActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "잘못된 요청입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data: patents, error } = await supabase
        .from("featured_patents")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, patents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      if (!data?.patent_number || !data?.title) {
        return new Response(
          JSON.stringify({ success: false, error: "특허번호와 제목은 필수입니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate lengths
      if (data.patent_number.length > 50 || data.title.length > 500) {
        return new Response(
          JSON.stringify({ success: false, error: "입력값이 너무 깁니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: patent, error } = await supabase
        .from("featured_patents")
        .insert({
          patent_number: data.patent_number.trim(),
          title: data.title.trim(),
          description: data.description?.trim()?.slice(0, 2000) || null,
          recommendation_reason: data.recommendation_reason?.trim()?.slice(0, 1000) || null,
          category: data.category?.trim()?.slice(0, 100) || null,
          transfer_status: data.transfer_status?.trim()?.slice(0, 100) || "기술이전 가능",
          contact_info: data.contact_info?.trim()?.slice(0, 500) || null,
          thumbnail_url: data.thumbnail_url?.trim()?.slice(0, 1000) || null,
          display_order: typeof data.display_order === "number" ? data.display_order : 0,
          is_active: data.is_active !== false,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, patent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      if (!data?.id) {
        return new Response(
          JSON.stringify({ success: false, error: "ID가 필요합니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.patent_number) updateData.patent_number = data.patent_number.trim().slice(0, 50);
      if (data.title) updateData.title = data.title.trim().slice(0, 500);
      if (data.description !== undefined) updateData.description = data.description?.trim()?.slice(0, 2000) || null;
      if (data.recommendation_reason !== undefined) updateData.recommendation_reason = data.recommendation_reason?.trim()?.slice(0, 1000) || null;
      if (data.category !== undefined) updateData.category = data.category?.trim()?.slice(0, 100) || null;
      if (data.transfer_status !== undefined) updateData.transfer_status = data.transfer_status?.trim()?.slice(0, 100) || null;
      if (data.contact_info !== undefined) updateData.contact_info = data.contact_info?.trim()?.slice(0, 500) || null;
      if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url?.trim()?.slice(0, 1000) || null;
      if (typeof data.display_order === "number") updateData.display_order = data.display_order;
      if (typeof data.is_active === "boolean") updateData.is_active = data.is_active;

      const { data: patent, error } = await supabase
        .from("featured_patents")
        .update(updateData)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, patent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!data?.id) {
        return new Response(
          JSON.stringify({ success: false, error: "ID가 필요합니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("featured_patents")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "알 수 없는 요청" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manage-featured-patents error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
