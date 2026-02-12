import { test, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "../database";
import {
  insertSession,
  getSession,
  updateSession,
  insertObservation,
  searchObservations,
  insertSummary,
  searchSummaries,
  insertUserPrompt,
  searchUserPrompts,
  insertPendingCompression,
  getPendingCompressions,
  updateCompressionStatus,
} from "../queries";
import { unlinkSync } from "fs";

const TEST_DB_PATH = "/tmp/opencode-mem-test-queries.sqlite";

let db: Database;

beforeAll(() => {
  try { unlinkSync(TEST_DB_PATH); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
  db = Database.create(TEST_DB_PATH);
});

afterAll(() => {
  db.close();
  try { unlinkSync(TEST_DB_PATH); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
});

// ─── Session CRUD ────────────────────────────────────────────────────────────

test("insertSession creates new session and returns id", () => {
  const id = insertSession(db, {
    session_id: "sess-001",
    project: "/test/project",
    user_prompt: "build a feature",
  });
  expect(id).toBeGreaterThan(0);
});

test("getSession retrieves session by session_id", () => {
  insertSession(db, {
    session_id: "sess-002",
    project: "/test/project",
    user_prompt: "fix a bug",
  });
  const session = getSession(db, "sess-002");
  expect(session).toBeDefined();
  expect(session!.session_id).toBe("sess-002");
  expect(session!.project).toBe("/test/project");
  expect(session!.user_prompt).toBe("fix a bug");
  expect(session!.status).toBe("active");
});

test("getSession returns null for non-existent session", () => {
  const session = getSession(db, "non-existent");
  expect(session).toBeNull();
});

test("updateSession modifies session fields", () => {
  insertSession(db, {
    session_id: "sess-003",
    project: "/test",
    user_prompt: "initial",
  });
  updateSession(db, "sess-003", { status: "completed" });
  const session = getSession(db, "sess-003");
  expect(session!.status).toBe("completed");
});

// ─── Observation CRUD + FTS5 ─────────────────────────────────────────────────

test("insertObservation creates observation and returns id", () => {
  insertSession(db, {
    session_id: "sess-obs-1",
    project: "/test",
    user_prompt: "test",
  });

  const id = insertObservation(db, {
    session_id: "sess-obs-1",
    project: "/test",
    raw_text: "Found authentication vulnerability in login handler",
    type: "bugfix",
    title: "Auth Vulnerability",
    subtitle: "Login handler SQL injection",
    narrative: "The login handler was vulnerable to SQL injection attacks",
    facts: ["SQL injection in login", "No input sanitization"],
    concepts: ["security", "authentication"],
    files_read: ["src/auth/login.ts"],
    files_modified: ["src/auth/login.ts"],
  });
  expect(id).toBeGreaterThan(0);
});

test("FTS5 search returns matching observations", () => {
  insertSession(db, {
    session_id: "sess-obs-2",
    project: "/test",
    user_prompt: "test",
  });

  insertObservation(db, {
    session_id: "sess-obs-2",
    project: "/test",
    raw_text: "Implemented caching layer for database queries",
    type: "feature",
    title: "Database Caching",
    narrative: "Added Redis-based caching for frequently accessed queries",
  });

  const results = searchObservations(db, "caching database");
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].item.title).toBe("Database Caching");
});

test("FTS5 search returns empty array for no matches", () => {
  const results = searchObservations(db, "xyznonexistent123");
  expect(results).toEqual([]);
});

// ─── Summary CRUD + FTS5 ────────────────────────────────────────────────────

test("insertSummary creates summary and returns id", () => {
  insertSession(db, {
    session_id: "sess-sum-1",
    project: "/test",
    user_prompt: "test",
  });

  const id = insertSummary(db, {
    session_id: "sess-sum-1",
    project: "/test",
    request: "Implement authentication system",
    investigated: "Reviewed existing auth libraries",
    learned: "Passport.js best for Express apps",
    completed: "Basic JWT auth flow",
    next_steps: "Add refresh tokens",
  });
  expect(id).toBeGreaterThan(0);
});

test("FTS5 search returns matching summaries", () => {
  const results = searchSummaries(db, "authentication JWT");
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].item.request).toBe("Implement authentication system");
});

// ─── User Prompt CRUD + FTS5 ────────────────────────────────────────────────

test("insertUserPrompt creates prompt and returns id", () => {
  insertSession(db, {
    session_id: "sess-prompt-1",
    project: "/test",
    user_prompt: "test",
  });

  const id = insertUserPrompt(db, {
    session_id: "sess-prompt-1",
    prompt_number: 1,
    prompt_text: "Help me refactor the authentication module",
  });
  expect(id).toBeGreaterThan(0);
});

test("FTS5 search returns matching user prompts", () => {
  const results = searchUserPrompts(db, "refactor authentication");
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].item.prompt_text).toContain("refactor");
});

// ─── Pending Compressions ───────────────────────────────────────────────────

test("insertPendingCompression creates pending compression", () => {
  const id = insertPendingCompression(db, {
    session_id: "sess-comp-1",
    tool_name: "Read",
    tool_input: JSON.stringify({ path: "/src/index.ts" }),
    tool_output: "file contents here",
    cwd: "/test/project",
  });
  expect(id).toBeGreaterThan(0);
});

test("getPendingCompressions returns pending items", () => {
  const items = getPendingCompressions(db);
  expect(items.length).toBeGreaterThan(0);
  expect(items.some((i) => i.tool_name === "Read")).toBe(true);
});

test("updateCompressionStatus changes status", () => {
  const id = insertPendingCompression(db, {
    session_id: "sess-comp-2",
    tool_name: "Write",
    tool_output: "success",
  });
  updateCompressionStatus(db, id, "processed");
  const items = getPendingCompressions(db);
  const updated = items.find((i) => i.id === id);
  expect(updated).toBeUndefined(); // processed items not returned by getPendingCompressions
});
