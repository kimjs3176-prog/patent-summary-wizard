# Exposing the service as MCP tools

Built with `@lovable.dev/mcp-js`. One file per tool in `src/lib/mcp/tools/`, registered
in `src/lib/mcp/index.ts`, served from `supabase/functions/mcp`.

```ts
export default defineTool({
  name: "search_patents",
  title: "Search patents",
  description: "…",                     // retrieval-critical: name the domain + institution
  inputSchema: { query: z.string().min(1).max(200) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query }) => {
    const { data, error } = await supabaseAnon().functions.invoke("search-patents", {
      body: { keyword: query },
    });
    if (error) throw new ToolError(`Patent search failed: ${error.message}`);
    return { content: [{ type: "text", text: `…` }], structuredContent: { … } };
  },
});
```

Rules:
- Tools are thin wrappers over edge functions — no business logic in the tool layer.
- Always set annotations; read-only tools must be marked so agents can call them freely.
- Throw `ToolError` with an actionable message; never return a success envelope on failure.
- Auth: `auth.oauth.issuer` against the backend auth issuer, audience `authenticated`.

## When porting

Change in `src/lib/mcp/index.ts`: `name`, `title`, `instructions` (must state the
institution and technology field so the calling agent knows the scope). Tool
descriptions should say "…patents held by <institution> in <field>" — the description
is what drives tool selection.

Regenerate `.lovable/mcp/manifest.json` by redeploying, then verify the deployed
`/functions/v1/mcp` endpoint responds before telling the user it is live.
