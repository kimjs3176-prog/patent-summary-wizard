import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { enforceRateLimit, peekRateLimit, recordRateLimitHit } from "../_shared/rateLimit.ts";
import { isSecretSettingKey } from "../_shared/kipris.ts";

// ---------- 관리자 비밀번호 저장/검증 ----------
// 저장 형식: "pbkdf2$<iterations>$<salt b64>$<hash b64>". 예전 행(솔트 없는 SHA-256 hex)은
// 로그인 성공 시 새 형식으로 자동 승격한다.
const PBKDF2_ITERATIONS = 120_000;
const MIN_PASSWORD_LENGTH = 12;
const ADMIN_FAIL_BUCKET = { bucket: "admin-auth-fail", limit: 5, windowSeconds: 900 };
const ADMIN_CALL_BUCKET = { bucket: "admin-auth", limit: 120, windowSeconds: 300 };

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const legacySha256Hex = async (password: string) => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const pbkdf2 = async (password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) => {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, keyMaterial, 256);
  return new Uint8Array(bits);
};

const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
};

/** 길이가 같은 두 문자열을 상수 시간에 비교한다. */
const timingSafeEqual = (a: string, b: string) => {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
};

const verifyPassword = async (password: string, stored: string): Promise<{ ok: boolean; needsUpgrade: boolean }> => {
  if (stored.startsWith("pbkdf2$")) {
    const [, iterStr, saltB64, hashB64] = stored.split("$");
    const iterations = parseInt(iterStr, 10);
    if (!Number.isFinite(iterations) || iterations < 1000 || !saltB64 || !hashB64) return { ok: false, needsUpgrade: false };
    const hash = await pbkdf2(password, unb64(saltB64), iterations);
    return { ok: timingSafeEqual(b64(hash), hashB64), needsUpgrade: false };
  }
  const legacy = await legacySha256Hex(password);
  return { ok: timingSafeEqual(legacy, stored), needsUpgrade: true };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 전체 호출량 상한 + 인증 실패 누적 상한(실패 5회/15분이면 비밀번호 검증 전에 차단)
  const limited = (await enforceRateLimit(req, ADMIN_CALL_BUCKET)) ?? (await peekRateLimit(req, ADMIN_FAIL_BUCKET));
  if (limited) return limited;

  try {
    const supabase = supabaseAdmin();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ success: false, error: "잘못된 요청입니다." }, 400);
    const { action, password, data } = body as { action?: unknown; password?: unknown; data?: any };

    // Verify admin password (DB override 우선, 없으면 환경변수 사용)
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    const { data: adminCredential } = await supabase
      .from("admin_credentials")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();

    const submittedPassword = typeof password === "string" ? password : "";
    let isAuthorized = false;
    let upgradeLegacyHash = false;
    if (submittedPassword) {
      if (adminCredential?.password_hash) {
        const verdict = await verifyPassword(submittedPassword, adminCredential.password_hash);
        isAuthorized = verdict.ok;
        upgradeLegacyHash = verdict.ok && verdict.needsUpgrade;
      } else if (adminPassword) {
        isAuthorized = timingSafeEqual(submittedPassword, adminPassword);
      }
    }

    if (!isAuthorized) {
      await recordRateLimitHit(req, ADMIN_FAIL_BUCKET);
      return json({ success: false, error: "인증 실패" }, 401);
    }

    if (upgradeLegacyHash) {
      try {
        await supabase
          .from("admin_credentials")
          .upsert({ id: 1, password_hash: await hashPassword(submittedPassword), updated_at: new Date().toISOString() }, { onConflict: "id" });
      } catch (e) {
        console.warn("legacy admin hash upgrade failed:", e instanceof Error ? e.message : String(e));
      }
    }

    const validActions = ["list", "create", "update", "delete", "fetch-patent-info", "list-settings", "update-settings", "list-cache", "delete-cache", "delete-all-cache", "change-password", "usage-stats", "visitor-stats", "satisfaction-comments", "list-notices", "create-notice", "update-notice", "delete-notice"];
    if (typeof action !== "string" || !validActions.includes(action)) {
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
      // 비밀값 키는 관리자 화면에도 내려보내지 않는다(함수 시크릿으로만 관리).
      for (const s of settings || []) if (!isSecretSettingKey(s.key)) map[s.key] = s.value || "";
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
        if (isSecretSettingKey(key)) {
          return json({ success: false, error: `${key} 는 사이트 설정에 저장할 수 없습니다. 함수 시크릿(KIPRIS_API_KEY)으로 설정해 주세요.` }, 400);
        }
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
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const fetchRes = await fetch(`${supabaseUrl}/functions/v1/fetch-patent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          // 내부 호출도 원래 요청자의 IP 기준으로 요청 제한을 받도록 전달
          "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
          "cf-connecting-ip": req.headers.get("cf-connecting-ip") ?? "",
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

      if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 100) {
        return json({ success: false, error: `비밀번호는 ${MIN_PASSWORD_LENGTH}~100자여야 합니다.` }, 400);
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
            currentModel: "google/gemini-3.8-flash",
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
      const quarterMap: Record<string, number> = {};
      let total = 0;
      for (const r of daily) {
        const d = String(r.visit_date);
        const ym = d.slice(0, 7);
        const y = d.slice(0, 4);
        const mo = parseInt(d.slice(5, 7), 10);
        const q = Math.floor((mo - 1) / 3) + 1;
        const qKey = `${y}-Q${q}`;
        monthMap[ym] = (monthMap[ym] || 0) + r.visit_count;
        yearMap[y] = (yearMap[y] || 0) + r.visit_count;
        quarterMap[qKey] = (quarterMap[qKey] || 0) + r.visit_count;
        total += r.visit_count;
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      const monthKey = todayKey.slice(0, 7);
      const yearKey = todayKey.slice(0, 4);
      const nowMonth = parseInt(todayKey.slice(5, 7), 10);
      const nowQuarter = Math.floor((nowMonth - 1) / 3) + 1;
      const quarterKey = `${yearKey}-Q${nowQuarter}`;
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
      const quarterly = Object.entries(quarterMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([quarter, count]) => ({ quarter, count }));

      const dailyAll = daily.map((r: { visit_date: string; visit_count: number }) => ({
        date: String(r.visit_date),
        count: r.visit_count,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          visitors: {
            total,
            today,
            thisMonth: monthMap[monthKey] || 0,
            thisQuarter: quarterMap[quarterKey] || 0,
            thisYear: yearMap[yearKey] || 0,
            last30,
            daily: dailyAll,
            monthly,
            quarterly,
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

    // ========== Satisfaction comments (admin only; the RPC is no longer callable by anon) ==========
    if (action === "satisfaction-comments") {
      const limit = Math.min(100, Math.max(1, Number(data?.limit) || 30));
      const { data: comments, error } = await supabase.rpc("get_satisfaction_comments", { p_limit: limit });
      if (error) throw error;
      return json({ success: true, comments: comments ?? [] });
    }

    // ========== Notices ==========
    const noticeInput = () => {
      if (!data || typeof data !== "object") return null;
      const title = typeof data.title === "string" ? data.title.trim().slice(0, 200) : "";
      if (!title) return null;
      const content = typeof data.content === "string" ? data.content.slice(0, 5000) : "";
      const order = Number(data.display_order);
      return {
        title,
        content: content || null,
        is_active: data.is_active !== false,
        is_pinned: data.is_pinned === true,
        display_order: Number.isFinite(order) ? Math.max(0, Math.min(9999, Math.round(order))) : 0,
      };
    };

    if (action === "create-notice") {
      const input = noticeInput();
      if (!input) return json({ success: false, error: "공지 제목이 필요합니다." }, 400);
      const { error } = await supabase.from("notices").insert(input);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-notice") {
      const input = noticeInput();
      if (!input || !data?.id) return json({ success: false, error: "공지 ID와 제목이 필요합니다." }, 400);
      const { error } = await supabase
        .from("notices")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-notice") {
      if (!data?.id) return json({ success: false, error: "공지 ID가 필요합니다." }, 400);
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
