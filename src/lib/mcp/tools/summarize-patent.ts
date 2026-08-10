import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "summarize_patent",
  title: "Summarize patent in plain language",
  description: "Generate an easy-to-read Korean summary of a patent, including core technology, problem solved, key means, quantitative effects, and commercialization fields.",
  inputSchema: {
    patent_number: z.string().min(5).max(30).describe("Korean patent number, e.g. 10-2017-0149000."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ patent_number }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase.functions.invoke("summarize-patent", {
      body: { patentNumber: patent_number },
    });

    if (error) {
      throw new ToolError(`Summary failed for ${patent_number}: ${error.message}`);
    }

    const result = data as { success: boolean; summary?: string; error?: string };
    if (!result.success || !result.summary) {
      throw new ToolError(result.error || "Could not generate summary.");
    }

    return {
      content: [{ type: "text", text: result.summary }],
    };
  },
});
