import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "recommend_similar_patents",
  title: "Recommend similar patents",
  description: "Find semantically similar Korean agricultural patents to a given patent number, with matching reason and keyword overlap.",
  inputSchema: {
    patent_number: z.string().min(5).max(30).describe("Korean patent number, e.g. 10-2017-0149000."),
    count: z.number().int().min(1).max(20).optional().describe("Maximum number of recommendations (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ patent_number, count }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase.functions.invoke("recommend-similar-patents", {
      body: { patentNumber: patent_number, count: count ?? 10 },
    });

    if (error) {
      throw new ToolError(`Recommendation failed for ${patent_number}: ${error.message}`);
    }

    const result = data as { success: boolean; recommendations?: any[]; error?: string };
    if (!result.success || !result.recommendations) {
      throw new ToolError(result.error || "Could not generate recommendations.");
    }

    return {
      content: [
        {
          type: "text",
          text: `Found ${result.recommendations.length} similar patents for ${patent_number}.`,
        },
      ],
      structuredContent: {
        patentNumber: patent_number,
        recommendations: result.recommendations,
      },
    };
  },
});
