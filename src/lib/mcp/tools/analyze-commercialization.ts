import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "analyze_commercialization",
  title: "Analyze commercialization potential",
  description: "Evaluate a patent's technology readiness, marketability, and business viability, returning scores, grade, and strategic recommendations.",
  inputSchema: {
    patent_number: z.string().min(5).max(30).describe("Korean patent number, e.g. 10-2017-0149000."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ patent_number }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase.functions.invoke("analyze-commercialization", {
      body: { patentNumber: patent_number },
    });

    if (error) {
      throw new ToolError(`Commercialization analysis failed for ${patent_number}: ${error.message}`);
    }

    const result = data as { success: boolean; analysis?: any; error?: string };
    if (!result.success || !result.analysis) {
      throw new ToolError(result.error || "Could not analyze commercialization potential.");
    }

    return {
      content: [
        {
          type: "text",
          text: `Commercialization analysis for ${patent_number}: total score ${result.analysis.totalScore ?? "N/A"}, grade ${result.analysis.grade ?? "N/A"}.`,
        },
      ],
      structuredContent: { patentNumber: patent_number, analysis: result.analysis },
    };
  },
});
