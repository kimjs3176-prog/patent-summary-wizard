import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "search_patents",
  title: "Search agricultural patents",
  description: "Search Korean agricultural patents from KIPRIS by keyword, inventor, or patent number. Returns a ranked list with titles, applicants, and relevance scores.",
  inputSchema: {
    query: z.string().min(1).max(200).describe("Search keyword, inventor name, or patent number."),
    count: z.number().int().min(1).max(50).optional().describe("Maximum number of results (default 20)."),
    source: z.enum(["all", "rda", "kipris"]).optional().describe("Source filter: all (default), rda, or kipris."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, count, source }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase.functions.invoke("search-patents", {
      body: {
        keyword: query,
        count: count ?? 20,
        source: source ?? "all",
      },
    });

    if (error) {
      throw new ToolError(`Patent search failed: ${error.message}`);
    }

    const result = data as { success: boolean; results?: any[]; error?: string; total?: number };
    if (!result.success || result.error) {
      throw new ToolError(result.error || "Patent search returned no results.");
    }

    return {
      content: [
        {
          type: "text",
          text: `Found ${result.total ?? result.results?.length ?? 0} patents for "${query}".`,
        },
      ],
      structuredContent: {
        query,
        total: result.total ?? result.results?.length ?? 0,
        patents: result.results ?? [],
      },
    };
  },
});
