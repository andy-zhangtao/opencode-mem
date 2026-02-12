/**
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem: Direct SQLite access. Uses search.ts getTimeline()
 * to return chronological observation list for a given session.
 */

import type { Database } from "../../db/database";
import { getTimeline, searchAll } from "../../db/search";

export interface TimelineArgs {
  sessionId?: string;
  anchor?: number;
  query?: string;
  project?: string;
  depthBefore?: number;
  depthAfter?: number;
}

export function timelineTool(db: Database, args: TimelineArgs): string {
  let sessionId = args.sessionId;

  if (args.anchor) {
    const row = db.raw
      .prepare("SELECT session_id FROM observations WHERE id = ?")
      .get(args.anchor) as { session_id: string } | null;

    if (!row) {
      throw new Error(`Observation #${args.anchor} not found`);
    }
    sessionId = row.session_id;
  }

  // If query provided and no sessionId/anchor, find best match first
  if (!sessionId && args.query) {
    const results = searchAll(db, args.query, {
      project: args.project,
      limit: 1,
    });

    if (results.length === 0) {
      return JSON.stringify({ entries: [], message: "No matching results found" });
    }

    sessionId = results[0].session_id;
  }

  if (!sessionId) {
    throw new Error(
      "One of 'sessionId', 'anchor', or 'query' is required",
    );
  }

  const entries = getTimeline(db, sessionId);

  // If anchor provided, apply depth windowing
  if (args.anchor && entries.length > 0) {
    const anchorIdx = entries.findIndex((e) => e.id === args.anchor);
    if (anchorIdx >= 0) {
      const before = args.depthBefore ?? 5;
      const after = args.depthAfter ?? 5;
      const start = Math.max(0, anchorIdx - before);
      const end = Math.min(entries.length, anchorIdx + after + 1);

      return JSON.stringify(
        {
          sessionId,
          anchor: args.anchor,
          total: entries.length,
          windowStart: start,
          windowEnd: end,
          entries: entries.slice(start, end),
        },
        null,
        2,
      );
    }
  }

  return JSON.stringify(
    {
      sessionId,
      total: entries.length,
      entries,
    },
    null,
    2,
  );
}
