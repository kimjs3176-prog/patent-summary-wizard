# Exposing the service as MCP tools

Any MCP server implementation works (TypeScript, Python, or a hosted MCP runtime). One
module per tool, registered in a single server entry, served over HTTP.

```ts
defineTool({
  name: "search_patents",
  title: "Search patents",
  description: "Search patents held by <institution> in <field>",
  inputSchema: { query: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query }) => {
    const res = await callEndpoint("search-patents", { keyword: query });
    if (!res.success) throw new ToolError(`Patent search failed: ${res.error}`);
    return { content: [{ type: "text", text: render(res) }], structuredContent: res };
  },
});
```

Rules:
- Tools are thin wrappers over the endpoints — no business logic in the tool layer.
- Always set annotations; mark read-only tools so agents can call them freely.
- Throw a tool error with an actionable message; never return a success envelope on failure.
- If auth is required, validate tokens against the backend's issuer and expected audience.
- Keep input schemas small and unconstrained (no long enums or tight bounds).

## When porting

Change the server `name`, `title`, and `instructions` — the instructions must state the
institution and technology field so the calling agent knows the scope. Tool descriptions
should read "…patents held by <institution> in <field>"; the description drives tool
selection more than anything else.

Regenerate the MCP manifest by redeploying, then verify the deployed MCP endpoint
responds before telling the user it is live.
