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

    // Fetch original image (with timeout to avoid stalled connections hanging the function)
    const imgController = new AbortController();
    const imgTimer = setTimeout(() => imgController.abort(), 15000);
    let upstream: Response;
    try {
      upstream = await fetch(url, {
        signal: imgController.signal,
        headers: {
          "User-Agent": "LovableCloudImageProxy/1.0",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(imgTimer);
    }

    if (!upstream.ok) {
      return new Response(JSON.stringify({ success: false, error: `Upstream error: ${upstream.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate response is actually an image
    // KIPRIS fileToss.jsp may return generic content-types like "application/octet-stream"
    // or even "text/html" for valid images, so we allow those through if from allowed domains
    const contentType = upstream.headers.get("content-type") || "";
    const isImageContentType = contentType.startsWith("image/");
    const isOctetStream = contentType.includes("application/octet-stream");
    const isKiprisFileToss = url.includes("fileToss.jsp");
    
    if (!isImageContentType && !isOctetStream && !isKiprisFileToss) {
      await upstream.body?.cancel();
      return new Response(JSON.stringify({ success: false, error: "Response is not an image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Sniff actual image type from magic bytes when upstream content-type is unreliable
    // (KIPRIS fileToss.jsp often returns "application/octet-stream" or even "text/html"
    // for both PNG and JPEG payloads — defaulting to image/png caused JPEG payloads to
    // be rejected by some browsers and rendered as broken images.)
    const sniffImageType = (bytes: Uint8Array): string | null => {
      if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
      if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
      if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
      if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
      return null;
    };

    const buffer = new Uint8Array(await upstream.arrayBuffer());
    const sniffed = sniffImageType(buffer);
    const resolvedContentType = isImageContentType ? contentType : (sniffed || "image/png");

    if (!isImageContentType && !sniffed) {
      // Upstream sent a non-image disguised as an image (e.g. HTML error page).
      return new Response(JSON.stringify({ success: false, error: "Upstream did not return a recognizable image" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheControl = upstream.headers.get("cache-control") || "public, max-age=86400";

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": resolvedContentType,
        "Cache-Control": cacheControl,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
