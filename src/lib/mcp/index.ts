import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchPatents from "./tools/search-patents";
import fetchPatent from "./tools/fetch-patent";
import summarizePatent from "./tools/summarize-patent";
import analyzeCommercialization from "./tools/analyze-commercialization";
import recommendSimilarPatents from "./tools/recommend-similar-patents";
import analyzeRegulations from "./tools/analyze-regulations";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ai-gisulbunseog",
  title: "AI 기술분석 서비스",
  version: "1.0.0",
  instructions:
    "Korean agricultural patent analysis tools. Use search_patents to find patents, fetch_patent to retrieve details, summarize_patent for plain-language summaries, analyze_commercialization for scoring and strategy, recommend_similar_patents for related patents, and analyze_regulations for applicable Korean laws.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchPatents, fetchPatent, summarizePatent, analyzeCommercialization, recommendSimilarPatents, analyzeRegulations],
});
