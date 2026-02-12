/**
 * OpenCode-Mem MCP Server
 *
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem: Direct SQLite access instead of HTTP proxy.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Database } from "../db/database.js";
import { searchTool, type SearchArgs } from "./tools/search.js";
import { timelineTool, type TimelineArgs } from "./tools/timeline.js";
import { getObservationsTool, type GetObservationsArgs } from "./tools/get-observations.js";
import { saveMemoryTool, type SaveMemoryArgs } from "./tools/save-memory.js";
import { importantTool } from "./tools/important.js";

// MCP uses stdio transport - stdout is reserved for JSON-RPC. Any console.log breaks the protocol.
const _originalLog = console.log;
console.log = (...args: any[]) => console.error("[MCP]", ...args);

const toolDefinitions = [
  {
    name: "__IMPORTANT",
    description: `3-LAYER WORKFLOW (ALWAYS FOLLOW):
1. search(query) → Get index with IDs (~50-100 tokens/result)
2. timeline(anchor=ID) → Get context around interesting results
3. get_observations([IDs]) → Fetch full details ONLY for filtered IDs
NEVER fetch full details without filtering first. 10x token savings.`,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search",
    description: "Step 1: Search memory index. Returns IDs + snippets. Params: query (required), project, sessionId, limit, offset, dateFrom, dateTo",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (required)" },
        project: { type: "string", description: "Filter by project" },
        sessionId: { type: "string", description: "Filter by session ID" },
        limit: { type: "number", description: "Max results (default 20)" },
        offset: { type: "number", description: "Pagination offset" },
        dateFrom: { type: "string", description: "Filter from date (ISO)" },
        dateTo: { type: "string", description: "Filter to date (ISO)" },
      },
      required: ["query"],
    },
  },
  {
    name: "timeline",
    description: "Step 2: Get chronological context. Params: sessionId OR anchor (observation ID) OR query (auto-finds), depthBefore, depthAfter, project",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID" },
        anchor: { type: "number", description: "Anchor observation ID" },
        query: { type: "string", description: "Query to find anchor" },
        project: { type: "string", description: "Filter by project" },
        depthBefore: { type: "number", description: "Entries before anchor (default 5)" },
        depthAfter: { type: "number", description: "Entries after anchor (default 5)" },
      },
    },
  },
  {
    name: "get_observations",
    description: "Step 3: Fetch full details for filtered IDs. ALWAYS batch for 2+ items. Params: ids (array, required), type (observation|summary)",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "number" }, description: "Array of observation/summary IDs (required)" },
        type: { type: "string", enum: ["observation", "summary"], description: "Type to fetch (default: observation)" },
      },
      required: ["ids"],
    },
  },
  {
    name: "save_memory",
    description: "Save a manual memory/observation for semantic search. Params: text (required), title, project",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Content to remember (required)" },
        title: { type: "string", description: "Short title (auto-generated if omitted)" },
        project: { type: "string", description: "Project name (default: opencode-mem)" },
      },
      required: ["text"],
    },
  },
];

export function createMCPServer(db: Database): Server {
  const server = new Server(
    { name: "opencode-mem-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case "__IMPORTANT": result = importantTool(); break;
        case "search": result = searchTool(db, args as SearchArgs); break;
        case "timeline": result = timelineTool(db, args as TimelineArgs); break;
        case "get_observations": result = getObservationsTool(db, args as GetObservationsArgs); break;
        case "save_memory": result = saveMemoryTool(db, args as SaveMemoryArgs); break;
        default: throw new Error(`Unknown tool: ${name}`);
      }

      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Tool ${name} failed:`, message);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  });

  return server;
}

export async function startMCPServer(dbPath?: string): Promise<void> {
  const db = Database.create(dbPath);
  const server = createMCPServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] OpenCode-Mem MCP server started");

  const cleanup = () => { console.error("[MCP] Shutting down"); db.close(); process.exit(0); };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

if (import.meta.main) {
  startMCPServer().catch((error) => {
    console.error("[MCP] Fatal error:", error);
    process.exit(1);
  });
}
