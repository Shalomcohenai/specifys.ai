/**
 * Specifys.ai MCP Server
 * Exposes specs (read/update) and tools list via Tools and Resources for Cursor / Claude Desktop.
 * Use STDIO transport; configure SPECIFYS_API_KEY and SPECIFYS_API_BASE_URL (optional).
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  apiGet,
  apiPut,
  type ListSpecsResponse,
  type GetSpecResponse,
  type PromptTemplatesResponse,
  type ListToolsResponse,
} from "./api.js";

// Log to stderr only (stdout is used for JSON-RPC)
function log(msg: string, ...args: unknown[]) {
  console.error("[specifys-mcp]", msg, ...args);
}

const server = new McpServer({
  name: "specifys",
  version: "1.0.0",
});

// ---- Read tools ----
server.registerTool(
  "list_my_specs",
  {
    description: "List the current user's specifications (metadata: id, title, createdAt, status).",
    inputSchema: {},
  },
  async () => {
    try {
      const data = await apiGet<ListSpecsResponse>("/specs");
      const text = JSON.stringify(data.specs, null, 2);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_spec",
  {
    description: "Get full spec document by specId (overview, technical, market, design, architecture when present).",
    inputSchema: { specId: z.string().describe("Spec document ID") },
  },
  async ({ specId }) => {
    try {
      const data = await apiGet<GetSpecResponse>(`/specs/${encodeURIComponent(specId)}`);
      const text = JSON.stringify(data.spec, null, 2);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_spec_overview",
  {
    description: "Get only the overview section of a spec by specId.",
    inputSchema: { specId: z.string().describe("Spec document ID") },
  },
  async ({ specId }) => {
    try {
      const data = await apiGet<GetSpecResponse>(`/specs/${encodeURIComponent(specId)}`);
      const text = data.spec.overview ?? "(no overview)";
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_spec_technical",
  {
    description: "Get only the technical specification section of a spec by specId.",
    inputSchema: { specId: z.string().describe("Spec document ID") },
  },
  async ({ specId }) => {
    try {
      const data = await apiGet<GetSpecResponse>(`/specs/${encodeURIComponent(specId)}`);
      const text = data.spec.technical ?? "(no technical spec)";
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_spec_design",
  {
    description: "Get only the design specification section of a spec by specId.",
    inputSchema: { specId: z.string().describe("Spec document ID") },
  },
  async ({ specId }) => {
    try {
      const data = await apiGet<GetSpecResponse>(`/specs/${encodeURIComponent(specId)}`);
      const text = data.spec.design ?? "(no design spec)";
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_spec_prompts",
  {
    description:
      "Get prompt templates reference (overview, technical, market, design) used by Specifys.ai for generation.",
    inputSchema: {},
  },
  async () => {
    try {
      const data = await apiGet<PromptTemplatesResponse>("/prompt-templates");
      const text = JSON.stringify(data.prompts, null, 2);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_spec_architecture",
  {
    description: "Get the architecture section of a spec by specId (Markdown + Mermaid).",
    inputSchema: { specId: z.string().describe("Spec document ID") },
  },
  async ({ specId }) => {
    try {
      const data = await apiGet<GetSpecResponse>(`/specs/${encodeURIComponent(specId)}`);
      const text = data.spec.architecture ?? "(no architecture)";
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  }
);

// ---- Update tools ----
function registerUpdateTool(
  name: string,
  description: string,
  field: "overview" | "technical" | "design" | "market" | "architecture"
) {
  server.registerTool(
    name,
    {
      description,
      inputSchema: {
        specId: z.string().describe("Spec document ID"),
        content: z.string().describe("New content for this section"),
      },
    },
    async ({ specId, content }) => {
      try {
        await apiPut(`/specs/${encodeURIComponent(specId)}`, { [field]: content });
        return {
          content: [{ type: "text" as const, text: `Updated ${field} for spec ${specId}.` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}

registerUpdateTool(
  "update_spec_overview",
  "Update the overview section of a spec (by specId) with new content.",
  "overview"
);
registerUpdateTool(
  "update_spec_technical",
  "Update the technical specification section of a spec (by specId) with new content.",
  "technical"
);
registerUpdateTool(
  "update_spec_design",
  "Update the design specification section of a spec (by specId) with new content.",
  "design"
);
registerUpdateTool(
  "update_spec_market",
  "Update the market specification section of a spec (by specId) with new content.",
  "market"
);
registerUpdateTool(
  "update_spec_architecture",
  "Update the architecture section of a spec (by specId) with new content.",
  "architecture"
);

// ---- Resources ----
// spec://{specId} – full spec content
server.registerResource(
  "spec",
  new ResourceTemplate("spec://{specId}", {
    list: async () => {
      try {
        const data = await apiGet<ListSpecsResponse>("/specs");
        return {
          resources: data.specs.map((s) => ({
            uri: `spec://${s.id}`,
            name: (s.title as string) || `Spec ${s.id}`,
            description: (s.title as string) || `Spec ${s.id}`,
            mimeType: "application/json",
          })),
        };
      } catch (err) {
        log("list spec resources error", err);
        return { resources: [] };
      }
    },
  }),
  { description: "Spec document by ID (overview, technical, design, market)" },
  async (uri, variables) => {
    const specId = typeof variables.specId === "string" ? variables.specId : Array.isArray(variables.specId) ? variables.specId[0] : undefined;
    if (!specId) {
      return { contents: [{ uri: uri.toString(), mimeType: "text/plain", text: "Missing specId" }] };
    }
    try {
      const data = await apiGet<GetSpecResponse>(`/specs/${encodeURIComponent(specId)}`);
      const text = JSON.stringify(data.spec, null, 2);
      return { contents: [{ uri: uri.toString(), mimeType: "application/json", text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        contents: [{ uri: uri.toString(), mimeType: "text/plain", text: `Error: ${msg}` }],
      };
    }
  }
);

// specifys://tools – static list of tools
server.registerResource(
  "specifys_tools",
  "specifys://tools",
  { description: "List of Vibe Coding tools from Specifys.ai" },
  async (uri) => {
    try {
      const data = await apiGet<ListToolsResponse>("/tools");
      const text = JSON.stringify(data.tools, null, 2);
      return { contents: [{ uri: uri.toString(), mimeType: "application/json", text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        contents: [{ uri: uri.toString(), mimeType: "text/plain", text: `Error: ${msg}` }],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Specifys MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
