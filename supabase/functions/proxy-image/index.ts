import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isHttpUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const urlFromQuery = new URL(req.url).searchParams.get("url");
    let url = urlFromQuery;

    if (!url && req.method !== "GET") {
      // allow POST { url }
      const body = await req.json().catch(() => null);
      url = body?.url;
    }

    if (!url || typeof url !== "string" || !isHttpUrl(url)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch original image
    const upstream = await fetch(url, {
      headers: {
        // Some hosts require a UA
        "User-Agent": "LovableCloudImageProxy/1.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ success: false, error: `Upstream error: ${upstream.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const cacheControl = upstream.headers.get("cache-control") || "public, max-age=86400";

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
