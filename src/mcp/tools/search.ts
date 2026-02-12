/**
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem: Direct SQLite access instead of HTTP proxy to Worker service.
 * Uses search.ts searchAll() for combined FTS5 search across observations, summaries, and prompts.
 */

import type { Database } from "../../db/database";
import { searchAll, type SearchOptions } from "../../db/search";

export interface SearchArgs {
  query: string;
  project?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function searchTool(db: Database, args: SearchArgs): string {
  if (!args.query || typeof args.query !== "string") {
    throw new Error("'query' parameter is required and must be a string");
  }

  const options: SearchOptions = {
    project: args.project,
    sessionId: args.sessionId,
    limit: args.limit ?? 20,
    offset: args.offset ?? 0,
    dateFrom: args.dateFrom ? new Date(args.dateFrom).getTime() / 1000 : undefined,
    dateTo: args.dateTo ? new Date(args.dateTo).getTime() / 1000 : undefined,
  };

  const results = searchAll(db, args.query, options);

  return JSON.stringify(
    {
      query: args.query,
      total: results.length,
      results,
    },
    null,
    2,
  );
}
