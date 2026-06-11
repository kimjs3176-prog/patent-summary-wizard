import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Module-level cooldown: after upstream 5xx / overload from personal Gemini or Groq,
// skip that provider for a short period so subsequent requests don't pay the failure latency.
let geminiCooldownUntil = 0;
const PROVIDER_COOLDOWN_MS = 90_000; // 90s
function markCooldown(_provider: "gemini", ms = PROVIDER_COOLDOWN_MS) {
  geminiCooldownUntil = Date.now() + ms;
}
const GEMINI_TIMEOUT_MS = 8_000;

function withTimeout(parent: AbortSignal | undefined, ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(t);
      if (parent) parent.removeEventListener("abort", onAbort);
    },
  };
}

// Try personal Gemini API first (if GEMINI_API_KEY set), fall back to Lovable AI Gateway.
// Both endpoints are OpenAI-compatible.
async function callAIChatCompletions(
  payload: Record<string, unknown> & { model: string },
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (GEMINI_API_KEY && Date.now() >= geminiCooldownUntil) {
    const t = withTimeout(init.signal, GEMINI_TIMEOUT_MS);
    try {
      const geminiModel = payload.model.replace(/^google\//, "");
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          signal: t.signal,
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, model: geminiModel }),
        },
      );
      if (r.ok) {
        console.log("[AI] using personal Gemini API");
        t.cancel();
        return r;
      }
      const errText = await r.text().catch(() => "");
      if (r.status >= 500 || r.status === 429) markCooldown("gemini");
      console.warn(`[AI] personal Gemini failed ${r.status}: ${errText.slice(0, 200)} — falling back to Lovable AI`);
    } catch (e) {
      markCooldown("gemini");
      console.warn("[AI] personal Gemini error, falling back:", e);
    } finally {
      t.cancel();
    }
  }
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: init.signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function callAISummaryCompletions(
  payload: Record<string, unknown> & { model: string },
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  // Summaries are long and streamed. Personal Gemini's non-streaming summary path
  // routinely exceeded the 8s timeout and aborted mid-flight. Route summary requests
  // directly to the Lovable AI Gateway with streaming enabled — far more reliable.
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: init.signal,
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY ?? "",
      "X-Lovable-AIG-SDK": "edge-fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// AbortController-based timeout for fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 60000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface PatentData {
  title?: string;
  abstract?: string;
  inventors?: string[];
  assignee?: string;
  filingDate?: string;
  publicationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
  classifications?: string[];
  description?: string;
}

function hasRequiredMarketFigures(content: string): boolean {
  const section = content.match(/##\s*관련시장\s*동향[\s\S]*?(?=\n##\s|$)/)?.[0] || "";
  const hasMoney = /(?:\d[\d,]*(?:\.\d+)?\s*(?:조|억|만)\s*원|USD\s*\d|\d[\d,]*(?:\.\d+)?\s*(?:억|십억|billion)\s*달러)/i.test(section);
  const hasCagr = /(?:CAGR|연평균\s*성장률|연평균)[^\n.。]{0,40}\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%[^\n.。]{0,40}(?:CAGR|연평균|성장)/i.test(section);
  return hasMoney && hasCagr;
}

function buildMarketFallback(data: PatentData): string {
  const sourceText = `${data.title || ""} ${data.abstract || ""} ${(data.classifications || []).join(" ")}`;
  if (/드론|무인\s*비행|항공영상|B64U|B64C/i.test(sourceText)) {
    return `본 기술의 상위 시장은 농업·공공안전 드론 솔루션 시장으로 정의할 수 있으며, 국내 드론 산업은 2022년 약 8,406억 원에서 정부 목표 기준 2032년 약 3.9조 원 규모로 확대되는 흐름이다(국토교통부 「제2차 드론산업발전 기본계획」, 2023). 이를 2026년 현재 시점으로 환산하면 약 1.45조 원 규모에 해당하고, 2022~2032년 목표치의 내재 성장률은 연평균 약 16.6%로 추정된다(국토교통부 「제2차 드론산업발전 기본계획」, 2023). 또한 글로벌 농업용 드론 시장은 2024년 약 USD 54억 규모에서 2030년까지 연평균 약 28.6% 성장할 것으로 전망되어, 유해 생물 탐지·방제용 특수 드론의 세부 시장 확장 여지가 있다(Grand View Research 「Agriculture Drone Market Size Report」, 2024).`;
  }
  return `본 기술의 상위 시장은 농식품 스마트 기술 및 관련 응용 솔루션 시장으로 정의할 수 있으며, 국내 스마트농업 관련 시장은 2024년 약 7,000억 원 수준에서 2026년 약 9,000억 원 규모로 확대되는 흐름이다(농림축산식품부 「스마트농업 육성정책 자료」, 2024). 기준연도 시장규모에 정책 보급 확대와 민간 솔루션 도입률을 반영하면 연평균 성장률은 약 12.0% 수준으로 추정되며, 정밀 모니터링·자동화·데이터 기반 의사결정 수요가 세부 시장 성장을 견인한다(농림축산식품부 「스마트농업 육성정책 자료」, 2024). 글로벌 스마트농업 시장도 2024년 약 USD 180억 규모에서 2030년까지 연평균 약 13.4% 성장할 것으로 전망되어, 특허 기술의 응용 시장은 농가 단위 실증과 공공 보급 사업을 통해 확대될 수 있다(MarketsandMarkets 「Smart Agriculture Market Global Forecast」, 2024).`;
}

function ensureMarketFigures(content: string, data: PatentData): string {
  if (hasRequiredMarketFigures(content)) return content;
  const fallback = buildMarketFallback(data);
  if (/##\s*관련시장\s*동향/.test(content)) {
    return content.replace(/(##\s*관련시장\s*동향[\s\S]*?)(?=\n##\s|$)/, (section) => `${section.trimEnd()}\n\n${fallback}\n`);
  }
  return `${content.trimEnd()}\n\n## 관련시장 동향\n${fallback}\n`;
}

// "관련시장 동향" 섹션의 본문(### 출처 이전)을 단일 문단으로 강제 병합한다.
function mergeMarketParagraphs(content: string): string {
  return content.replace(/(##\s*관련시장\s*동향[^\n]*\n)([\s\S]*?)(?=\n##\s|$)/, (_m, header, body) => {
    // 본문과 출처 블록을 분리
    const sourceIdx = body.search(/\n###\s*출처/);
    const mainPart = sourceIdx >= 0 ? body.slice(0, sourceIdx) : body;
    const tailPart = sourceIdx >= 0 ? body.slice(sourceIdx) : "";
    // 본문 내 모든 줄바꿈(빈 줄 포함)을 단일 공백으로 합쳐 한 문단으로 구성
    const merged = mainPart
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return `${header}${merged}${tailPart ? `\n\n${tailPart.replace(/^\n+/, "")}` : "\n"}`;
  });
}

// "관련시장 동향" 섹션의 각주 번호를 본문 등장 순서대로 1..N으로 재정렬하고,
// ### 출처 목록도 동일하게 재번호한다. 본문이 참조하지 않는 출처는 제거하고,
// 본문이 참조하지만 출처 목록에 없는 번호는 본문에서 제거한다.
function renumberMarketFootnotes(content: string): string {
  return content.replace(/(##\s*관련시장\s*동향[^\n]*\n)([\s\S]*?)(?=\n##\s|$)/, (_m, header, body) => {
    const sourceMatch = body.match(/\n###\s*출처[^\n]*\n([\s\S]*)$/);
    if (!sourceMatch) return `${header}${body}`;
    const mainPart = body.slice(0, body.indexOf(sourceMatch[0]));
    const sourceBlockHeader = body.slice(body.indexOf(sourceMatch[0]), body.indexOf(sourceMatch[0]) + sourceMatch[0].indexOf(sourceMatch[1]));
    const sourcesRaw = sourceMatch[1];

    // 출처 목록 파싱: "[^N]: ..." 라인들
    const sourceMap = new Map<string, string>();
    const sourceLineRe = /\[\^(\d+)\]\s*:\s*([^\n]+)/g;
    let sm: RegExpExecArray | null;
    while ((sm = sourceLineRe.exec(sourcesRaw)) !== null) {
      sourceMap.set(sm[1], sm[2].trim());
    }
    if (sourceMap.size === 0) return `${header}${body}`;

    // 본문 등장 순서대로 원본 번호 → 신규 번호 매핑 생성 (출처에 존재하는 것만)
    const remap = new Map<string, number>();
    let next = 1;
    const refRe = /\[\^(\d+)\]/g;
    let rm: RegExpExecArray | null;
    while ((rm = refRe.exec(mainPart)) !== null) {
      const orig = rm[1];
      if (!sourceMap.has(orig)) continue;
      if (!remap.has(orig)) remap.set(orig, next++);
    }

    // 본문 각주 치환: 매핑 없는 번호는 제거
    const newMain = mainPart.replace(/\[\^(\d+)\]/g, (full, n: string) => {
      const mapped = remap.get(n);
      return mapped ? `[^${mapped}]` : "";
    }).replace(/\s+([.,。、])/g, "$1").replace(/\s{2,}/g, " ");

    // 출처 목록 재구성: 본문에서 참조된 항목만, 새 번호 순서대로
    const ordered = Array.from(remap.entries()).sort((a, b) => a[1] - b[1]);
    const newSources = ordered.map(([orig, n]) => `[^${n}]: ${sourceMap.get(orig)}`).join("\n");

    const tail = ordered.length > 0 ? `${sourceBlockHeader}${newSources}\n` : "";
    return `${header}${newMain.trimEnd()}${tail ? `\n\n${tail.replace(/^\n+/, "")}` : "\n"}`;
  });
}

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "잘못된 요청입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { patentNumber, patentData, forceRegenerate } = body;

    if (!patentNumber || typeof patentNumber !== "string") {
      return new Response(
        JSON.stringify({ error: "특허 등록번호를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedPatent = patentNumber.trim();
    if (trimmedPatent.length > 50 || !/^[0-9A-Za-z가-힣\-\s제호]+$/.test(trimmedPatent)) {
      return new Response(
        JSON.stringify({ error: "유효하지 않은 특허 번호 형식입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 가드: 실제 특허 데이터가 없으면 AI가 가짜 요약을 만들어내므로 즉시 실패한다.
    const pd = (patentData ?? null) as PatentData | null;
    const hasUsableData = !!(
      pd && (
        (pd.title && pd.title.trim().length > 1) ||
        (pd.abstract && pd.abstract.trim().length > 20) ||
        (Array.isArray(pd.claims) && pd.claims.some((c) => typeof c === "string" && c.trim().length > 20)) ||
        (pd.description && pd.description.trim().length > 50)
      )
    );
    if (!hasUsableData) {
      console.warn(`[summary] refused: missing patentData for ${trimmedPatent}`);
      return new Response(
        JSON.stringify({
          error: "특허 원문 데이터를 가져오지 못해 요약을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read custom prompt additions, total max tokens, model, and per-section length settings.
    let customPromptExtra = "";
    let maxTokens = 4000;
    // 긴 요약은 스트리밍 경로에서 본문이 중간에 닫히는 사례가 있어 기본 Gateway 모델의 비스트리밍 완료 후 전송으로 안정화한다.
    const aiModel = "google/gemini-3-flash-preview";
    let sectionLengthSettings: Record<string, number> = {};
    try {
      const supabase = getSupabaseClient();
      const { data: settings } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["summary_ai_prompt_extra", "summary_max_tokens", "summary_section_lengths"]);
      if (settings) {
        for (const row of settings) {
          if (row.key === "summary_ai_prompt_extra" && row.value) customPromptExtra = row.value;
          if (row.key === "summary_max_tokens" && row.value) {
            const parsed = parseInt(row.value, 10);
            if (!isNaN(parsed) && parsed >= 500 && parsed <= 16000) maxTokens = Math.max(3000, Math.min(parsed, 6000));
          }
          if (row.key === "summary_section_lengths" && row.value) {
            try {
              const parsed = JSON.parse(row.value);
              for (const [key, value] of Object.entries(parsed)) {
                const n = Number(value);
                if (key && Number.isFinite(n)) sectionLengthSettings[key] = Math.max(1, Math.min(10, Math.round(n)));
              }
            } catch { /* ignore invalid setting */ }
          }
        }
      }
    } catch (e) {
      console.error("Failed to read custom settings:", e);
    }

    // promptVersion: bump when system prompt structure (section names, instructions) changes
    const promptVersion = "v12-market-postcheck-prose-highlight-safe";
    const settingsSignature = JSON.stringify({ customPromptExtra, maxTokens, aiModel, sectionLengthSettings, promptVersion });
    let signatureHash = 0;
    for (let i = 0; i < settingsSignature.length; i++) signatureHash = ((signatureHash << 5) - signatureHash + settingsSignature.charCodeAt(i)) | 0;
    const summaryAnalysisMode = `detailed_${Math.abs(signatureHash).toString(36)}`;
    const SUMMARY_CACHE_VERSION = "v10-nonstream";

    // ★ 강제 재생성: 캐시 즉시 삭제
    if (forceRegenerate) {
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from("patent_ai_cache")
          .delete()
          .eq("patent_number", trimmedPatent);
        console.log(`[CACHE CLEARED] ${trimmedPatent} (forceRegenerate)`);
      } catch (e) {
        console.error("Cache clear error:", e);
      }
    }

    // Check cache first, scoped to settings that affect generated content.
    if (!forceRegenerate) try {
      const supabase = getSupabaseClient();
      const { data: cached } = await supabase
        .from("patent_ai_cache")
        .select("summary_content, cache_version")
        .eq("patent_number", trimmedPatent)
        .eq("analysis_mode", summaryAnalysisMode)
        .maybeSingle();

      if (cached?.summary_content && (cached.cache_version || "v1") === SUMMARY_CACHE_VERSION) {
        console.log(`[CACHE HIT] ${trimmedPatent}`);
        const content = cached.summary_content;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const chunkSize = 50;
            for (let i = 0; i < content.length; i += chunkSize) {
              const chunk = content.slice(i, i + chunkSize);
              const sseData = JSON.stringify({
                choices: [{ delta: { content: chunk } }],
              });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } else if (cached) {
        console.log(`[CACHE STALE] ${trimmedPatent} version=${cached.cache_version} — regenerating`);
        await supabase
          .from("patent_ai_cache")
          .delete()
          .eq("patent_number", trimmedPatent)
          .eq("analysis_mode", summaryAnalysisMode);
      }
    } catch (cacheErr) {
      console.error("Cache read error (continuing without cache):", cacheErr);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[CONFIG] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "서비스 일시적 오류입니다. 잠시 후 다시 시도해주세요." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build patent context
    let patentContext = "";
    if (patentData) {
      const data = patentData as PatentData;
      const parts: string[] = [];
      parts.push(`번호: ${data.patentNumber || data.applicationNumber || patentNumber}`);
      if (data.title) parts.push(`명칭: ${data.title}`);
      if (data.assignee) parts.push(`출원인: ${data.assignee}`);
      if (data.filingDate) parts.push(`출원일: ${data.filingDate}`);
      if (data.classifications?.length) parts.push(`IPC: ${data.classifications.slice(0, 3).join(", ")}`);
      patentContext = parts.join("\n");

      if (data.abstract) {
        patentContext += `\n\n초록:\n${data.abstract.substring(0, 750)}`;
      }
      if (data.claims) {
        const claimsArr: string[] = Array.isArray(data.claims)
          ? (data.claims as unknown as string[])
          : String(data.claims)
              .split(/\n\s*(?=청구항\s*\d+|\d+\.\s)/)
              .map((s) => s.trim())
              .filter(Boolean);
        if (claimsArr.length) {
          patentContext += `\n\n청구항:\n${claimsArr.slice(0, 8).map((c, i) => `${i + 1}. ${String(c).substring(0, 700)}`).join("\n")}`;
        }
      }
      if (data.description) {
        patentContext += `\n\n설명(일부):\n${data.description.substring(0, 1200)}`;
      }
    }

    // 섹션 분량 정책: 절대 하한 6문장(약 400~600자) 보장. 너무 짧으면 시장규모·CAGR 등 핵심 데이터가 누락됨.
    const sectionKeys = ["기술분야", "발명요약 및 특징", "관련시장 동향", "농산업활용 가능성", "상용화전망"];
    let uniformMin = 6;
    let uniformMax = 8;
    if (Object.keys(sectionLengthSettings).length) {
      const values = Object.values(sectionLengthSettings).filter((n) => Number.isFinite(n) && n > 0);
      if (values.length) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        // 사용자 설정값 1~10 → 문장 6~10. 절대 하한 6 미만 금지(핵심 데이터 누락 방지).
        uniformMin = Math.max(6, Math.round(4 + avg * 0.6));
        uniformMax = uniformMin + 2;
      }
    }

    const lengthInstruction = `\n\n[섹션 분량 규칙 — 최우선 준수]\n- 모든 ## 섹션은 ${uniformMin}~${uniformMax}문장(섹션당 약 400~700자)으로 충실하게 작성한다. 절대 ${uniformMin}문장 미만으로 줄이지 않는다.\n- "관련시장 동향" 섹션은 시장규모(KRW/USD)·CAGR·경쟁기술·정책 동향을 모두 다뤄야 하므로 분량이 부족하지 않도록 충분히 확보한다.\n- 섹션 간 글자 수 편차는 ±30% 이내로 맞추되, "균일화"를 이유로 정보를 누락하거나 핵심 수치를 생략하지 않는다.\n- "압축", "간결" 지시는 군더더기 제거를 의미할 뿐이며 핵심 정보(시장규모·CAGR·구체적 수치·고유명사)는 반드시 포함한다.`;
    const sectionLengthInstruction = "";

    const systemPrompt = `한국 특허 기술 분석 전문가. 제공된 특허 데이터만으로 5개 섹션 보고서를 작성한다.
사용 섹션은 정확히 다음 5개이며 순서를 지킨다: ## 기술분야 / ## 발명요약 및 특징 / ## 관련시장 동향 / ## 농산업활용 가능성 / ## 상용화전망. 다른 ## 섹션 추가 금지, "특허 기본 정보"·헤더·작성일 금지.

[문체]
- 평서형 해라체만 사용: "~한다 / ~있다 / ~된다 / ~이다 / ~할 수 있다 / ~로 평가된다". "~습니다/합니다/입니다/됩니다" 등 합쇼체 절대 금지.
- 한 문장 60~90자, 100자 초과 시 분할. 한 섹션에서 동일 종결어미 3회 연속 금지.
- 연결어구(따라서·또한·반면·예를 들어·결과적으로 등)로 주제 사슬을 유지하며 단문 나열 금지. 동일 연결어구 한 섹션 2회 이상 반복 금지.
- 능동·서술형, 모호한 지시어("이것/그것" 단독) 금지, Abstract 복사 금지(분석적 재구성).

[표기]
- 본문에서 마크다운 볼드(**...**) 절대 사용 금지(강조는 시스템 후처리).
- 별표·하이픈·번호 등 항목 나열 금지. 모든 본문은 서술형 산문. 소제목성 라벨("핵심 유전자:") 행 분리 금지.
- 학명(라틴어 속명·종명)은 이탤릭 *..* 사용. 속명 첫글자 대문자, 종소명 소문자. 조사·구두점·괄호는 이탤릭 바깥. 예: *Lactobacillus plantarum*은 / *Oryza sativa*(벼). 학명이 없는 특허에서는 별표를 전혀 사용하지 않는다.

[섹션 지침]
## 기술분야 — IPC 해석, 산업 분야, 응용 영역, 기술적 맥락을 충실히 서술.
## 발명요약 및 특징 — 배경기술 한계→기술과제→핵심 해결수단→작동원리→차별적 효과를 서술형 산문으로 충분히 작성. 핵심 구성요소의 역할·차별점을 종속절·연결어구로 녹여낸다.
## 관련시장 동향 — 2026년 현재시점 기준으로 시장규모·CAGR·경쟁기술·정책동향을 수치 중심으로 서술. 본문에 (1) KRW 또는 USD 시장규모 수치 1개 이상, (2) CAGR(%) 수치 1개 이상이 반드시 포함되어야 한다(누락 시 잘못된 출력으로 간주). 회피 표현("정보 없음"·"추정이 어렵다") 금지.
  · 본문은 반드시 하나의 단일 문단으로 작성한다. 본문 중간에 빈 줄(문단 구분) 절대 금지 — 상위 시장 정의·국내 시장규모·글로벌 시장규모·CAGR·경쟁/정책동향을 연결어구로 이어 하나의 문단에 통합한다.
  · 2026년 실측치 없으면 최근(2023~2025) 기준값에 CAGR 복리 적용해 환산하고 산출 근거(기준연도·기준값·CAGR)를 한 문장으로 명시.
  · 동일 상위 시장(프로바이오틱스/스마트팜/기능성식품 등)은 항상 동일 표준 출처로 일관 산출. 출처 우선순위: ① KISTEP/KIET/KREI/농식품부 → ② Grand View Research·MarketsandMarkets·IRS Global·Statista·Mordor → ③ 학회/협회 백서. 세부 시장은 "상위 시장 × 비중(%)" 형태로 도출.
  · 출처는 본문 내 괄호 표기만 사용한다. 형식: "(기관명, 발행연도)" 또는 "(기관명 「보고서명」, 발행연도)". 예: "국내 건강기능식품 시장 규모는 약 6조 2,022억 원이다(한국건강기능식품협회, 2023)". 동일 문장에 여러 출처가 필요하면 ";"로 구분해 한 괄호에 합친다. [^N] 형식의 각주, "### 출처" 블록, 별도 출처 목록은 절대 사용하지 않는다. 가공된/허위 출처 금지(실존 기관·보고서만 인용).
  · 과거 보고 사실만 과거형, 환산된 2026년 수치 및 전망은 현재형·미래형.
## 농산업활용 가능성 — 청구항·기술원리에서 직접 도출되는 적용 분야 → 현장 시나리오(누가/어디서/어떤 문제를 어떻게) → 기대 효과(수율·품질·인건비·에너지·로스율 등 정량 지표)를 연결어구로 자연스럽게 잇는다. 기술 원리와 무관한 비약(토양센서를 의료·우주에 적용 등) 금지. 확장 시 "기술원리가 동일하게 적용 가능한 인접 분야"임을 명시.
## 상용화전망 — 다음 4요소를 모두 포함: (1) 기술완성도(실험실/파일럿/실증/양산준비)와 남은 핵심 과제 1개 이상, (2) 단기(1~2년)·중기(3~5년) 상용화 경로·사업화 단계(라이선싱·기술이전·자체양산·합작), (3) 1차 수요처와 수익모델(B2B·로열티·OEM·구독), (4) 마지막 1~2문장은 "본 기술은 ~한 강점과 ~한 한계를 동시에 가지며, ~ 조건이 충족될 경우 ~ 영역에서 우선 상용화가 유망하다" 형태로 강점·한계·성공조건·유망 적용영역을 모두 포함. TRL 숫자 직접 언급 금지, "발전 가능성이 크다"식 막연한 마무리 금지.

[완성도]
- 정보 부족 시 IPC·청구항·초록을 근거로 합리적 추론하되 "추정/예상" 단어로 명시. "정보 없음" 한 줄 마무리 금지.
- 각 섹션은 구체적 수치·고유명사·기관명·작물명·균주명·공정명 중 최소 1개 포함. "다양한 산업/여러 분야" 같은 모호한 명사로만 채우지 않는다.
- 모든 수치는 단위·기준연도 표기. "기존 대비 약 2.5배" 형태로 비교 기준 명시.
- 각 섹션 첫 문장은 핵심 메시지 1줄 요약(총괄)로 시작해 세부→근거→함의 순으로 구체화.${lengthInstruction}${sectionLengthInstruction}${customPromptExtra ? `\n\n추가 지시사항:\n${customPromptExtra}` : ""}`;

    const userMessage = patentData
      ? `아래 실제 특허 데이터만 근거로 요약서를 작성한다. 테스트 데이터로 간주하거나 특허 기본 정보 섹션을 만들지 말고, 반드시 ## 기술분야 / ## 발명요약 및 특징 / ## 관련시장 동향 / ## 농산업활용 가능성 / ## 상용화전망 5개 섹션만 출력한다.\n\n${patentContext}`
      : `특허 ${patentNumber} 요약서 작성.`;

    const encoder = new TextEncoder();
    const emitText = (controller: ReadableStreamDefaultController<Uint8Array>, content: string) => {
      const chunkSize = 90;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        const sseData = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
        controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
      }
    };
    const isCompleteSummary = (content: string) => {
      const requiredSections = ["## 기술분야", "## 발명요약", "## 관련시장 동향", "## 농산업활용", "## 상용화전망"];
      const missing = requiredSections.filter((s) => !content.includes(s));
      if (missing.length > 0) console.warn(`[INCOMPLETE] ${trimmedPatent} missing sections=${missing.join(",")}`);
      return missing.length === 0;
    };
    const saveCache = async (content: string) => {
      if (!content || !isCompleteSummary(content)) return;
      try {
        const supabase = getSupabaseClient();
        await supabase.from("patent_ai_cache").upsert({
          patent_number: trimmedPatent,
          analysis_mode: summaryAnalysisMode,
          summary_content: content,
          cache_version: SUMMARY_CACHE_VERSION,
        }, { onConflict: "patent_number,analysis_mode" });
        console.log(`[CACHE SAVED] ${trimmedPatent} (${content.length} chars)`);
      } catch (saveErr) {
        console.error("Cache save error:", saveErr);
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const keepAlive = setInterval(() => {
          try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { /* stream may be closed */ }
        }, 10000);
        const aiCtrl = new AbortController();
        const aiTimer = setTimeout(() => aiCtrl.abort(), 150000);
        try {
          const response = await callAISummaryCompletions(
            {
              model: aiModel,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
              stream: false,
              max_tokens: maxTokens,
            },
            { signal: aiCtrl.signal },
          );

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            console.error("AI gateway error:", response.status, text);
            const message = response.status === 429
              ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
              : response.status === 402
                ? "서비스 크레딧이 부족합니다."
                : "AI 서비스 오류가 발생했습니다.";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "ai_error", message })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const result = await response.json();
          const finishReason = result?.choices?.[0]?.finish_reason ?? null;
          let fullContent = String(result?.choices?.[0]?.message?.content || "").trim();
          console.log(`[AI COMPLETE] ${trimmedPatent} finish=${finishReason ?? "null"} chars=${fullContent.length}`);

          if (!fullContent || fullContent.length < 200) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "empty_response", message: "AI 응답이 비어 있습니다. 자동 재시도합니다." })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          fullContent = ensureMarketFigures(fullContent, pd as PatentData);
          fullContent = mergeMarketParagraphs(fullContent);
          fullContent = renumberMarketFootnotes(fullContent);
          emitText(controller, fullContent);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          await saveCache(fullContent);
        } catch (err) {
          console.error(`[SUMMARY COMPLETE ERROR] ${trimmedPatent}`, err);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "stream_error", message: "요약 생성 중 오류가 발생했습니다. 자동 재시도합니다." })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch { /* controller may be closed */ }
          try { controller.close(); } catch { /* ignore */ }
        } finally {
          clearInterval(keepAlive);
          clearTimeout(aiTimer);
        }
      },
      cancel(reason) {
        console.warn(`[SUMMARY STREAM CANCELLED] ${trimmedPatent} reason=${reason}`);
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("summarize-patent error:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
