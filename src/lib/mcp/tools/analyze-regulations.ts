import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "analyze_regulations",
  title: "Analyze regulations for commercialization",
  description: "Identify Korean laws and regulations that may apply when commercializing a technology, based on the patent's technical field.",
  inputSchema: {
    patent_number: z.string().min(5).max(30).describe("Korean patent number, e.g. 10-2017-0149000."),
    tech_field: z.string().max(100).optional().describe("Optional technical field override (e.g. 'functional food', 'agricultural machinery')."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async ({ patent_number, tech_field }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase.functions.invoke("analyze-regulations", {
      body: { patentNumber: patent_number, techField: tech_field },
    });

    if (error) {
      throw new ToolError(`Regulation analysis failed for ${patent_number}: ${error.message}`);
    }

    const result = data as { success: boolean; regulations?: any[]; summary?: string; error?: string };
    if (!result.success || !result.regulations) {
      throw new ToolError(result.error || "Could not analyze regulations.");
    }

    return {
      content: [
        {
          type: "text",
          text: result.summary || `Identified ${result.regulations.length} potentially relevant regulations for ${patent_number}.`,
        },
      ],
      structuredContent: {
        patentNumber: patent_number,
        regulations: result.regulations,
      },
    };
  },
});
