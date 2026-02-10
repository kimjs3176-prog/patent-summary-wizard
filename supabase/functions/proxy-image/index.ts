import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strict domain allowlist for patent image sources
const ALLOWED_DOMAINS = [
  "kipris.or.kr",
  "www.kipris.or.kr",
  "plus.kipris.or.kr",
  "kipo.go.kr",
  "www.kipo.go.kr",
];

const isAllowedDomain = (hostname: string): boolean => {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith("." + d)
  );
};

const isPrivateIp = (hostname: string): boolean => {
  return (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
    hostname === "[::1]" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  );
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
      const body = await req.json().catch(() => null);
      url = body?.url;
    }

    if (!url || typeof url !== "string" || !isHttpUrl(url)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF protection: validate domain allowlist and block private IPs
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    if (isPrivateIp(hostname)) {
      return new Response(JSON.stringify({ success: false, error: "Private IP not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAllowedDomain(hostname)) {
      return new Response(JSON.stringify({ success: false, error: "Domain not in allowlist" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch original image
    const upstream = await fetch(url, {
      headers: {
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

    // Validate response is actually an image
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      await upstream.body?.cancel();
      return new Response(JSON.stringify({ success: false, error: "Response is not an image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    return new Response(JSON.stringify({ success: false, error: "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
