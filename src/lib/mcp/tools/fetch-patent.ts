import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "fetch_patent",
  title: "Fetch patent details",
  description: "Retrieve detailed bibliographic data, claims, abstract, and representative drawing for a Korean patent by its patent number.",
  inputSchema: {
    patent_number: z.string().min(5).max(30).describe("Korean patent number, e.g. 10-2017-0149000."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ patent_number }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase.functions.invoke("fetch-patent", {
      body: { patentNumber: patent_number },
    });

    if (error) {
      throw new ToolError(`Failed to fetch patent ${patent_number}: ${error.message}`);
    }

    const result = data as { success: boolean; data?: any; error?: string };
    if (!result.success || !result.data) {
      throw new ToolError(result.error || `Patent ${patent_number} not found.`);
    }

    return {
      content: [
        { type: "text", text: `Retrieved details for ${patent_number}: ${result.data.titleKo || result.data.title || ""}` },
      ],
      structuredContent: { patentNumber: patent_number, patent: result.data },
    };
  },
});
