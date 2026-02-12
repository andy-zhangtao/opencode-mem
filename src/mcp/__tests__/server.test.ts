/**
 * MCP Server tests
 *
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "../../db/database";
import { createMCPServer } from "../server";
import { insertSession, insertObservation } from "../../db/queries";
import { searchTool } from "../tools/search";
import { timelineTool } from "../tools/timeline";
import { getObservationsTool } from "../tools/get-observations";
import { saveMemoryTool } from "../tools/save-memory";
import { importantTool } from "../tools/important";

describe("MCP Server", () => {
  let db: Database;

  beforeEach(() => {
    db = Database.create(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("creates server instance", () => {
    const server = createMCPServer(db);
    expect(server).toBeDefined();
  });
});

describe("search tool", () => {
  let db: Database;

  beforeEach(() => {
    db = Database.create(":memory:");
    insertSession(db, {
      session_id: "search-session",
      project: "search-project",
      user_prompt: "Test search",
      status: "active",
    });
    insertObservation(db, {
      session_id: "search-session",
      project: "search-project",
      raw_text: "React hooks implementation",
      type: "tool_use",
      title: "React hooks",
      narrative: "Implemented React hooks",
    });
  });

  afterEach(() => {
    db.close();
  });

  test("returns search results", () => {
    const result = searchTool(db, { query: "React" });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBeGreaterThanOrEqual(1);
    expect(parsed.results[0].title).toContain("React");
  });

  test("respects limit parameter", () => {
    const result = searchTool(db, { query: "React", limit: 0 });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(0);
  });

  test("filters by project", () => {
    const result = searchTool(db, { query: "React", project: "nonexistent" });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(0);
  });

  test("throws on missing query", () => {
    expect(() => searchTool(db, {} as any)).toThrow("'query' parameter is required");
  });
});

describe("timeline tool", () => {
  let db: Database;

  beforeEach(() => {
    db = Database.create(":memory:");
    insertSession(db, {
      session_id: "timeline-session",
      project: "timeline-project",
      user_prompt: "Test timeline",
      status: "active",
    });
    insertObservation(db, {
      session_id: "timeline-session",
      project: "timeline-project",
      raw_text: "First observation",
      type: "tool_use",
      title: "First",
    });
    insertObservation(db, {
      session_id: "timeline-session",
      project: "timeline-project",
      raw_text: "Second observation",
      type: "tool_use",
      title: "Second",
    });
  });

  afterEach(() => {
    db.close();
  });

  test("returns timeline by sessionId", () => {
    const result = timelineTool(db, { sessionId: "timeline-session" });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(2);
    expect(parsed.entries[0].title).toBe("First");
    expect(parsed.entries[1].title).toBe("Second");
  });

  test("returns empty for nonexistent session", () => {
    const result = timelineTool(db, { sessionId: "nonexistent" });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(0);
  });

  test("throws when no identifier provided", () => {
    expect(() => timelineTool(db, {})).toThrow("One of 'sessionId', 'anchor', or 'query' is required");
  });
});

describe("get_observations tool", () => {
  let db: Database;
  let observationId: number;

  beforeEach(() => {
    db = Database.create(":memory:");
    insertSession(db, {
      session_id: "obs-session",
      project: "obs-project",
      user_prompt: "Test",
      status: "active",
    });
    observationId = insertObservation(db, {
      session_id: "obs-session",
      project: "obs-project",
      raw_text: "Test observation content",
      type: "tool_use",
      title: "Test Obs",
      narrative: "Full narrative text",
    });
  });

  afterEach(() => {
    db.close();
  });

  test("returns observation by ID", () => {
    const result = getObservationsTool(db, { ids: [observationId] });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(1);
    expect(parsed.items[0].id).toBe(observationId);
    expect(parsed.items[0].title).toBe("Test Obs");
  });

  test("throws on missing ids", () => {
    expect(() => getObservationsTool(db, {} as any)).toThrow("'ids' parameter is required");
  });

  test("throws on empty ids array", () => {
    expect(() => getObservationsTool(db, { ids: [] })).toThrow("'ids' parameter is required");
  });
});

describe("save_memory tool", () => {
  let db: Database;

  beforeEach(() => {
    db = Database.create(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("saves manual memory", () => {
    const result = saveMemoryTool(db, { text: "Important note to remember" });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.id).toBeDefined();
  });

  test("uses provided title", () => {
    const result = saveMemoryTool(db, { text: "Content", title: "Custom Title" });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  test("throws on missing text", () => {
    expect(() => saveMemoryTool(db, {} as any)).toThrow("'text' parameter is required");
  });
});

describe("important tool", () => {
  test("returns workflow documentation", () => {
    const result = importantTool();
    expect(result).toContain("3-Layer Pattern");
    expect(result).toContain("search");
    expect(result).toContain("timeline");
    expect(result).toContain("get_observations");
  });
});
