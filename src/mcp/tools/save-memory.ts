/**
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem: Direct SQLite access. Inserts a manual observation
 * using insertObservation() with type='manual'.
 */

import type { Database } from "../../db/database";
import { insertSession, getSession } from "../../db/queries";
import { insertObservation } from "../../db/queries";

export interface SaveMemoryArgs {
  text: string;
  title?: string;
  project?: string;
}

const MCP_SESSION_ID = "mcp-manual-memories";

function ensureSession(db: Database, project: string): void {
  const existing = getSession(db, MCP_SESSION_ID);
  if (!existing) {
    insertSession(db, {
      session_id: MCP_SESSION_ID,
      project,
      user_prompt: "Manual memories saved via MCP tools",
      status: "active",
    });
  }
}

export function saveMemoryTool(db: Database, args: SaveMemoryArgs): string {
  if (!args.text || typeof args.text !== "string") {
    throw new Error("'text' parameter is required and must be a string");
  }

  const project = args.project ?? "opencode-mem";
  const title = args.title ?? args.text.slice(0, 80);

  ensureSession(db, project);

  const id = insertObservation(db, {
    session_id: MCP_SESSION_ID,
    project,
    raw_text: args.text,
    type: "manual",
    title,
    narrative: args.text,
  });

  return JSON.stringify(
    {
      success: true,
      id,
      message: `Memory saved with ID #${id}`,
    },
    null,
    2,
  );
}
