/**
 * HTTP Server for Viewer UI API
 *
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Uses Bun.serve() for minimal dependencies.
 */

import type { Database } from "../db/database";
import { searchAll, getTimeline, getFullObservations, getFullSummaries } from "../db/search";
import { getSessionList, getSessionObservations, getStats, getAllProjects } from "../db/queries";
import { logger } from "../utils/logger";

const DEFAULT_PORT = 37778;
const MAX_PORT_ATTEMPTS = 10;

interface HTTPRoute {
  pattern: URLPattern;
  handler: (req: Request, db: Database, match: URLPatternResult) => Response | Promise<Response>;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

const routes: HTTPRoute[] = [
  {
    pattern: new URLPattern({ pathname: "/api/health" }),
    handler: () => jsonResponse({ status: "ok", timestamp: Date.now() }),
  },
  {
    pattern: new URLPattern({ pathname: "/api/stats" }),
    handler: (_, db) => jsonResponse(getStats(db)),
  },
  {
    pattern: new URLPattern({ pathname: "/api/projects" }),
    handler: (_, db) => jsonResponse(getAllProjects(db)),
  },
  {
    pattern: new URLPattern({ pathname: "/api/sessions" }),
    handler: (req, db) => {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const project = url.searchParams.get("project") || undefined;
      return jsonResponse(getSessionList(db, { limit, offset, project }));
    },
  },
  {
    pattern: new URLPattern({ pathname: "/api/sessions/:sessionId" }),
    handler: (_, db, match) => {
      const sessionId = match.pathname.groups.sessionId;
      const observations = getSessionObservations(db, sessionId);
      return jsonResponse({ sessionId, observations });
    },
  },
  {
    pattern: new URLPattern({ pathname: "/api/search" }),
    handler: (req, db) => {
      const url = new URL(req.url);
      const query = url.searchParams.get("q");
      if (!query) return errorResponse("Missing 'q' parameter");
      const project = url.searchParams.get("project") || undefined;
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const results = searchAll(db, query, { project, limit });
      return jsonResponse({ query, total: results.length, results });
    },
  },
  {
    pattern: new URLPattern({ pathname: "/api/timeline/:sessionId" }),
    handler: (_, db, match) => {
      const sessionId = match.pathname.groups.sessionId;
      const entries = getTimeline(db, sessionId);
      return jsonResponse({ sessionId, total: entries.length, entries });
    },
  },
  {
    pattern: new URLPattern({ pathname: "/api/observations/:id" }),
    handler: (_, db, match) => {
      const id = parseInt(match.pathname.groups.id || "0");
      if (!id || !Number.isInteger(id)) return errorResponse("Invalid id");
      const items = getFullObservations(db, [id]);
      if (items.length === 0) return errorResponse("Observation not found", 404);
      return jsonResponse(items[0]);
    },
  },
  {
    pattern: new URLPattern({ pathname: "/api/observations" }),
    handler: (req, db) => {
      const url = new URL(req.url);
      const idsParam = url.searchParams.get("ids");
      if (!idsParam) return errorResponse("Missing 'ids' parameter");
      const ids = idsParam.split(",").map(Number).filter(Number.isInteger);
      if (ids.length === 0) return errorResponse("Invalid ids");
      const type = url.searchParams.get("type") || "observation";
      const items = type === "summary" ? getFullSummaries(db, ids) : getFullObservations(db, ids);
      return jsonResponse({ type, total: items.length, items });
    },
  },
];

async function handleRequest(req: Request, db: Database): Promise<Response> {
  for (const route of routes) {
    const match = route.pattern.exec(req.url);
    if (match) {
      try {
        return await route.handler(req, db, match);
      } catch (err) {
        logger.error("[HTTP] Route error:", err);
        return errorResponse(String(err), 500);
      }
    }
  }
  return errorResponse("Not found", 404);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = Bun.serve({
      port,
      fetch() {
        return new Response("checking");
      },
    });
    server.stop();
    resolve(true);
  }).catch(() => false);
}

export function startHTTPServer(db: Database, startPort = DEFAULT_PORT): number | null {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    try {
      Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

          if (req.method === "OPTIONS") {
            return new Response(null, {
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
              },
            });
          }

          if (url.pathname === "/") {
            const viewerPath = `${import.meta.dir}/ui/viewer.html`;
            const file = Bun.file(viewerPath);
            if (await file.exists()) {
              return new Response(file, { headers: { "Content-Type": "text/html" } });
            }
            return jsonResponse({ name: "opencode-mem", version: "0.1.0", status: "running" });
          }

          return handleRequest(req, db);
        },
      });

      logger.info(`[HTTP] Server started on port ${port}`);
      return port;
    } catch (err) {
      logger.debug(`[HTTP] Port ${port} unavailable, trying next...`);
    }
  }

  logger.warn("[HTTP] Could not start server on any port, skipping HTTP UI");
  return null;
}
