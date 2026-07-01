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
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

    // Verify admin password (DB override 우선, 없으면 환경변수 사용)
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    const { data: adminCredential } = await supabase
      .from("admin_credentials")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();

    const submittedPassword = typeof password === "string" ? password : "";
    const submittedHash = submittedPassword ? await hashPassword(submittedPassword) : "";

    const isAuthorized = adminCredential?.password_hash
      ? submittedHash === adminCredential.password_hash
      : !!adminPassword && submittedPassword === adminPassword;

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, error: "인증 실패" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validActions = ["list", "create", "update", "delete", "fetch-patent-info", "list-settings", "update-settings", "list-cache", "delete-cache", "delete-all-cache", "change-password", "usage-stats", "visitor-stats", "list-notices", "create-notice", "update-notice", "delete-notice"];
    if (!action || !validActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "잘못된 요청입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Site Settings ==========
    if (action === "list-settings") {
      const { data: settings, error } = await supabase
        .from("site_settings")
        .select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const s of settings || []) map[s.key] = s.value || "";
      return new Response(
        JSON.stringify({ success: true, settings: map }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-settings") {
      if (!data || typeof data !== "object") {
        return new Response(
          JSON.stringify({ success: false, error: "설정 데이터가 필요합니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      for (const [key, value] of Object.entries(data)) {
        if (typeof key !== "string" || key.length > 100) continue;
        const val = typeof value === "string" ? value.slice(0, 2000) : "";
        await supabase
          .from("site_settings")
          .upsert({ key, value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Fetch patent info from KIPRIS ==========
    if (action === "fetch-patent-info") {
      if (!data?.patent_number) {
        return new Response(
          JSON.stringify({ success: false, error: "특허번호가 필요합니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Call fetch-patent edge function internally
      const fetchRes = await fetch(`${supabaseUrl}/functions/v1/fetch-patent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ patentNumber: data.patent_number }),
      });
      const fetchResult = await fetchRes.json();

      if (fetchResult.success && fetchResult.data) {
        const pd = fetchResult.data;
        return new Response(
          JSON.stringify({
            success: true,
            patentInfo: {
              title: pd.titleKo || pd.title || "",
              thumbnail_url: pd.representativeImage || (pd.images?.[0]) || "",
              applicant: pd.applicant || pd.assignee || "",
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "특허 정보를 가져올 수 없습니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Cache Management ==========
    if (action === "list-cache") {
      const { count: dataCount } = await supabase
        .from("patent_data_cache")
        .select("*", { count: "exact", head: true });
      const { count: aiCount } = await supabase
        .from("patent_ai_cache")
        .select("*", { count: "exact", head: true });
      const { count: scoreCount } = await supabase
        .from("patent_score_cache")
        .select("*", { count: "exact", head: true });

      const page = typeof data?.page === "number" ? data.page : 0;
      const pageSize = 20;
      const { data: cacheItems, error } = await supabase
        .from("patent_data_cache")
        .select("id, patent_number, created_at")
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      return new Response(
        JSON.stringify({
          success: true,
          counts: { data: dataCount || 0, ai: aiCount || 0, score: scoreCount || 0 },
          items: cacheItems || [],
          page,
          pageSize,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-cache") {
      if (!data?.ids || !Array.isArray(data.ids)) {
        return new Response(
          JSON.stringify({ success: false, error: "삭제할 항목 ID가 필요합니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Delete from all cache tables by patent_number
      const { data: items } = await supabase
        .from("patent_data_cache")
        .select("patent_number")
        .in("id", data.ids);
      const numbers = (items || []).map((i: any) => i.patent_number);

      const { error: e1 } = await supabase.from("patent_data_cache").delete().in("id", data.ids);
      if (numbers.length > 0) {
        await supabase.from("patent_ai_cache").delete().in("patent_number", numbers);
        await supabase.from("patent_score_cache").delete().in("patent_number", numbers);
      }
      if (e1) throw e1;
      return new Response(
        JSON.stringify({ success: true, deleted: data.ids.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-all-cache") {
      await supabase.from("patent_data_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("patent_ai_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("patent_score_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Password Management ==========
    if (action === "change-password") {
      const newPassword = typeof data?.new_password === "string" ? data.new_password.trim() : "";

      if (newPassword.length < 4 || newPassword.length > 100) {
        return new Response(
          JSON.stringify({ success: false, error: "비밀번호는 4~100자여야 합니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const password_hash = await hashPassword(newPassword);
      const { error } = await supabase
        .from("admin_credentials")
        .upsert({ id: 1, password_hash, updated_at: new Date().toISOString() }, { onConflict: "id" });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Featured Patents CRUD ==========
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

    // ========== Usage Stats ==========
    if (action === "usage-stats") {
      // Count totals
      const [aiRes, scoreRes, dataRes, searchRes] = await Promise.all([
        supabase.from("patent_ai_cache").select("id", { count: "exact", head: true }),
        supabase.from("patent_score_cache").select("id", { count: "exact", head: true }),
        supabase.from("patent_data_cache").select("id", { count: "exact", head: true }),
        supabase.from("patent_search_stats").select("search_count"),
      ]);

      const totalSearches = (searchRes.data || []).reduce((sum: number, r: { search_count: number }) => sum + r.search_count, 0);

      // Recent 7 days summaries
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [recentAiRes, recentSearchRes] = await Promise.all([
        supabase.from("patent_ai_cache").select("created_at").gte("created_at", sevenDaysAgo),
        supabase.from("patent_search_stats").select("last_searched_at, search_count").gte("last_searched_at", sevenDaysAgo),
      ]);

      // Group by date
      const groupByDate = (items: { date: string }[]) => {
        const map: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          map[`${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`] = 0;
        }
        for (const item of items) {
          const d = new Date(item.date);
          const key = `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
          if (key in map) map[key]++;
        }
        return Object.entries(map).map(([date, count]) => ({ date, count }));
      };

      const recentSummaries = groupByDate(
        (recentAiRes.data || []).map((r: { created_at: string }) => ({ date: r.created_at }))
      );
      const recentSearches = groupByDate(
        (recentSearchRes.data || []).map((r: { last_searched_at: string }) => ({ date: r.last_searched_at }))
      );

      // Top searched
      const { data: topSearched } = await supabase
        .from("patent_search_stats")
        .select("patent_number, patent_title, search_count")
        .order("search_count", { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            totalSummaries: aiRes.count || 0,
            totalScores: scoreRes.count || 0,
            totalDataCache: dataRes.count || 0,
            totalSearches,
            recentSummaries,
            recentSearches,
            topSearched: topSearched || [],
            currentModel: "google/gemini-2.5-flash",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Visitor Stats ==========
    if (action === "visitor-stats") {
      const { data: rows, error } = await supabase
        .from("daily_visits")
        .select("visit_date, visit_count")
        .order("visit_date", { ascending: true });
      if (error) throw error;

      const daily = rows || [];
      const monthMap: Record<string, number> = {};
      const yearMap: Record<string, number> = {};
      let total = 0;
      for (const r of daily) {
        const d = String(r.visit_date);
        const ym = d.slice(0, 7);
        const y = d.slice(0, 4);
        monthMap[ym] = (monthMap[ym] || 0) + r.visit_count;
        yearMap[y] = (yearMap[y] || 0) + r.visit_count;
        total += r.visit_count;
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      const monthKey = todayKey.slice(0, 7);
      const yearKey = todayKey.slice(0, 4);
      const today = daily.find((r: { visit_date: string }) => String(r.visit_date) === todayKey)?.visit_count || 0;

      // Last 30 days padded
      const last30: { date: string; count: number }[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const rec = daily.find((r: { visit_date: string }) => String(r.visit_date) === key);
        last30.push({ date: key.slice(5), count: rec?.visit_count || 0 });
      }

      const monthly = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));
      const yearly = Object.entries(yearMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, count]) => ({ year, count }));

      return new Response(
        JSON.stringify({
          success: true,
          visitors: {
            total,
            today,
            thisMonth: monthMap[monthKey] || 0,
            thisYear: yearMap[yearKey] || 0,
            last30,
            monthly,
            yearly,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Notices ==========
    if (action === "list-notices") {
      const { data: notices, error } = await supabase
        .from("notices")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, notices: notices || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create-notice") {
      const { error } = await supabase.from("notices").insert({
        title: data.title,
        content: data.content || null,
        is_active: data.is_active ?? true,
        is_pinned: data.is_pinned ?? false,
        display_order: data.display_order ?? 0,
      });
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-notice") {
      const { error } = await supabase
        .from("notices")
        .update({
          title: data.title,
          content: data.content || null,
          is_active: data.is_active ?? true,
          is_pinned: data.is_pinned ?? false,
          display_order: data.display_order ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-notice") {
      const { error } = await supabase.from("notices").delete().eq("id", data.id);
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
