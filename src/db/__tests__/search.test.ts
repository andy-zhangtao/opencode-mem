import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { Database } from "../database";
import {
  searchObservations,
  searchSummaries,
  searchUserPrompts,
  searchAll,
  getTimeline,
  getSessionList,
  getFullObservations,
  getFullSummaries,
  type SearchOptions,
  type LayerOneResult,
  type TimelineEntry,
  type SessionListEntry,
} from "../search";
import { insertSession, insertObservation, insertSummary, insertUserPrompt } from "../queries";
import { unlinkSync } from "fs";

const TEST_DB_PATH = "/tmp/opencode-mem-test-search.sqlite";

let db: Database;

beforeAll(() => {
  try { unlinkSync(TEST_DB_PATH); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
  db = Database.create(TEST_DB_PATH);

  // ─── Seed test data ──────────────────────────────────────────────────────
  insertSession(db, {
    session_id: "sess-search-1",
    project: "/project/alpha",
    user_prompt: "implement authentication",
  });
  insertSession(db, {
    session_id: "sess-search-2",
    project: "/project/beta",
    user_prompt: "fix database performance",
  });
  insertSession(db, {
    session_id: "sess-search-3",
    project: "/project/alpha",
    user_prompt: "add caching layer",
  });

  // Observations for session 1
  insertObservation(db, {
    session_id: "sess-search-1",
    project: "/project/alpha",
    raw_text: "Found authentication bug in login endpoint",
    type: "bugfix",
    title: "Authentication Bug in Login",
    subtitle: "SQL injection vulnerability in authentication layer",
    narrative: "The authentication login handler was vulnerable to SQL injection attacks through the username field",
    facts: ["SQL injection possible", "No input sanitization"],
    concepts: ["security", "authentication"],
    files_read: ["src/auth/login.ts"],
    files_modified: ["src/auth/login.ts"],
    prompt_number: 1,
  });
  insertObservation(db, {
    session_id: "sess-search-1",
    project: "/project/alpha",
    raw_text: "Implemented JWT token refresh mechanism",
    type: "feature",
    title: "JWT Authentication Token Refresh",
    subtitle: "Auto-refresh expired authentication tokens",
    narrative: "Added automatic authentication token refresh using refresh tokens stored in httpOnly cookies",
    facts: ["Refresh tokens in httpOnly cookies", "15min access token TTL"],
    concepts: ["authentication", "jwt"],
    files_read: ["src/auth/tokens.ts"],
    files_modified: ["src/auth/tokens.ts", "src/middleware/auth.ts"],
    prompt_number: 2,
  });

  // Observations for session 2
  insertObservation(db, {
    session_id: "sess-search-2",
    project: "/project/beta",
    raw_text: "Optimized database queries with index analysis",
    type: "performance",
    title: "Database Query Optimization",
    subtitle: "Added missing indexes",
    narrative: "Added composite indexes for frequently joined tables reducing query time by 80%",
    facts: ["80% query time reduction", "3 new composite indexes"],
    concepts: ["performance", "database"],
    files_read: ["src/db/schema.sql"],
    files_modified: ["src/db/migrations/add-indexes.sql"],
    prompt_number: 1,
  });

  // Observations for session 3
  insertObservation(db, {
    session_id: "sess-search-3",
    project: "/project/alpha",
    raw_text: "Implemented Redis caching for API responses",
    type: "feature",
    title: "Redis Caching Layer",
    subtitle: "Cache frequently accessed data",
    narrative: "Added Redis-based caching middleware for API endpoints with configurable TTL",
    concepts: ["caching", "performance"],
    files_modified: ["src/middleware/cache.ts"],
    prompt_number: 1,
  });

  // Summaries
  insertSummary(db, {
    session_id: "sess-search-1",
    project: "/project/alpha",
    request: "Implement authentication system with JWT",
    investigated: "Reviewed existing auth libraries and JWT best practices",
    learned: "Passport.js combined with custom JWT is best for Express apps",
    completed: "Basic JWT auth flow with refresh tokens",
    next_steps: "Add rate limiting to auth endpoints",
  });
  insertSummary(db, {
    session_id: "sess-search-2",
    project: "/project/beta",
    request: "Fix slow database queries",
    investigated: "Analyzed query execution plans",
    learned: "Missing indexes on join columns caused full table scans",
    completed: "Added composite indexes, reduced query time by 80%",
    next_steps: "Monitor query performance in production",
  });

  // User prompts
  insertUserPrompt(db, {
    session_id: "sess-search-1",
    prompt_number: 1,
    prompt_text: "Help me fix the authentication vulnerability in the login handler",
  });
  insertUserPrompt(db, {
    session_id: "sess-search-1",
    prompt_number: 2,
    prompt_text: "Now implement JWT token refresh so sessions don't expire",
  });
  insertUserPrompt(db, {
    session_id: "sess-search-2",
    prompt_number: 1,
    prompt_text: "The database queries are extremely slow, help me optimize them",
  });
});

afterAll(() => {
  db.close();
  try { unlinkSync(TEST_DB_PATH); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
});

// ─── Layer 1: searchObservations ─────────────────────────────────────────────

describe("searchObservations (Layer 1)", () => {
  test("returns ranked results with IDs, snippets, scores", () => {
    const results = searchObservations(db, "authentication");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("snippet");
    expect(results[0]).toHaveProperty("rank");
    expect(results[0]).toHaveProperty("session_id");
    expect(results[0]).toHaveProperty("created_at");
    expect(results[0].type).toBe("observation");
    // rank is negative float, lower = better match
    expect(results[0].rank).toBeLessThan(0);
  });

  test("returns title in results", () => {
    const results = searchObservations(db, "login");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("Authentication Bug in Login");
  });

  test("filters by project", () => {
    const alphaResults = searchObservations(db, "authentication", {
      project: "/project/alpha",
    });
    const betaResults = searchObservations(db, "authentication", {
      project: "/project/beta",
    });
    expect(alphaResults.length).toBeGreaterThan(0);
    // Authentication observations are only in alpha project
    expect(betaResults.length).toBe(0);
  });

  test("filters by sessionId", () => {
    const results = searchObservations(db, "authentication", {
      sessionId: "sess-search-1",
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.session_id).toBe("sess-search-1"));
  });

  test("supports pagination with limit and offset", () => {
    const results1 = searchObservations(db, "authentication OR database OR caching", { limit: 2, offset: 0 });
    const results2 = searchObservations(db, "authentication OR database OR caching", { limit: 2, offset: 2 });
    expect(results1.length).toBeLessThanOrEqual(2);
    if (results2.length > 0) {
      const ids1 = new Set(results1.map((r) => r.id));
      results2.forEach((r) => expect(ids1.has(r.id)).toBe(false));
    }
  });

  test("supports date range filter", () => {
    const now = Math.floor(Date.now() / 1000);
    const results = searchObservations(db, "authentication", {
      dateFrom: now - 3600, // 1 hour ago
      dateTo: now + 3600,   // 1 hour from now
    });
    expect(results.length).toBeGreaterThan(0);

    // Very old dateFrom should still work if data is recent
    const oldResults = searchObservations(db, "authentication", {
      dateFrom: now + 86400, // tomorrow - should find nothing
    });
    expect(oldResults.length).toBe(0);
  });

  test("returns empty array for no matches", () => {
    const results = searchObservations(db, "xyznonexistent123");
    expect(results).toEqual([]);
  });
});

// ─── Layer 1: searchSummaries ────────────────────────────────────────────────

describe("searchSummaries (Layer 1)", () => {
  test("returns ranked results with snippets", () => {
    const results = searchSummaries(db, "authentication JWT");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("snippet");
    expect(results[0]).toHaveProperty("rank");
    expect(results[0].type).toBe("summary");
  });

  test("filters by project", () => {
    const results = searchSummaries(db, "indexes OR queries", {
      project: "/project/beta",
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.session_id).toBe("sess-search-2"));
  });

  test("returns empty for no matches", () => {
    const results = searchSummaries(db, "xyznonexistent999");
    expect(results).toEqual([]);
  });
});

// ─── Layer 1: searchUserPrompts ──────────────────────────────────────────────

describe("searchUserPrompts (Layer 1)", () => {
  test("returns ranked results with snippets", () => {
    const results = searchUserPrompts(db, "authentication vulnerability");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("snippet");
    expect(results[0]).toHaveProperty("rank");
    expect(results[0].type).toBe("prompt");
  });

  test("filters by sessionId", () => {
    const results = searchUserPrompts(db, "database optimize", {
      sessionId: "sess-search-2",
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.session_id).toBe("sess-search-2"));
  });
});

// ─── Layer 1: searchAll (combined) ───────────────────────────────────────────

describe("searchAll (Layer 1 - combined)", () => {
  test("merges results from all FTS tables", () => {
    const results = searchAll(db, "authentication");
    expect(results.length).toBeGreaterThan(0);
    // Should include multiple types
    const types = new Set(results.map((r) => r.type));
    // "authentication" appears in observations, summaries, and prompts
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  test("results are sorted by rank (best first)", () => {
    const results = searchAll(db, "authentication");
    for (let i = 1; i < results.length; i++) {
      // rank is negative, lower = better, so sorted ascending
      expect(results[i].rank).toBeGreaterThanOrEqual(results[i - 1].rank);
    }
  });

  test("respects limit across combined results", () => {
    const results = searchAll(db, "authentication", { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("respects project filter across all types", () => {
    const results = searchAll(db, "indexes OR database OR query", {
      project: "/project/beta",
    });
    results.forEach((r) => {
      expect(["sess-search-2"].includes(r.session_id)).toBe(true);
    });
  });
});

// ─── Layer 2: getTimeline ────────────────────────────────────────────────────

describe("getTimeline (Layer 2)", () => {
  test("returns chronological observations for a session", () => {
    const timeline = getTimeline(db, "sess-search-1");
    expect(timeline.length).toBe(2);
    expect(timeline[0]).toHaveProperty("id");
    expect(timeline[0]).toHaveProperty("type");
    expect(timeline[0]).toHaveProperty("title");
    expect(timeline[0]).toHaveProperty("created_at");
    expect(timeline[0]).toHaveProperty("prompt_number");
  });

  test("entries are in chronological order (ASC)", () => {
    const timeline = getTimeline(db, "sess-search-1");
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].created_at).toBeGreaterThanOrEqual(timeline[i - 1].created_at);
    }
  });

  test("returns empty array for non-existent session", () => {
    const timeline = getTimeline(db, "non-existent-session");
    expect(timeline).toEqual([]);
  });

  test("includes subtitle in timeline entries", () => {
    const timeline = getTimeline(db, "sess-search-1");
    expect(timeline[0].subtitle).toBe("SQL injection vulnerability in authentication layer");
  });
});

// ─── Layer 2: getSessionList ─────────────────────────────────────────────────

describe("getSessionList (Layer 2)", () => {
  test("returns sessions with metadata", () => {
    const sessions = getSessionList(db);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty("session_id");
    expect(sessions[0]).toHaveProperty("project");
    expect(sessions[0]).toHaveProperty("observation_count");
    expect(sessions[0]).toHaveProperty("first_observation_at");
    expect(sessions[0]).toHaveProperty("last_observation_at");
  });

  test("observation_count is accurate", () => {
    const sessions = getSessionList(db);
    const sess1 = sessions.find((s) => s.session_id === "sess-search-1");
    expect(sess1).toBeDefined();
    expect(sess1!.observation_count).toBe(2); // 2 observations in sess-search-1
  });

  test("sessions ordered by created_at DESC", () => {
    const sessions = getSessionList(db);
    for (let i = 1; i < sessions.length; i++) {
      expect(sessions[i].created_at).toBeLessThanOrEqual(sessions[i - 1].created_at);
    }
  });

  test("supports limit", () => {
    const sessions = getSessionList(db, { limit: 1 });
    expect(sessions.length).toBe(1);
  });

  test("supports offset for pagination", () => {
    const page1 = getSessionList(db, { limit: 1, offset: 0 });
    const page2 = getSessionList(db, { limit: 1, offset: 1 });
    expect(page1.length).toBe(1);
    if (page2.length > 0) {
      expect(page1[0].session_id).not.toBe(page2[0].session_id);
    }
  });

  test("filters by project", () => {
    const sessions = getSessionList(db, { project: "/project/alpha" });
    expect(sessions.length).toBe(2); // sess-search-1 and sess-search-3
    sessions.forEach((s) => expect(s.project).toBe("/project/alpha"));
  });
});

// ─── Layer 3: getFullObservations ────────────────────────────────────────────

describe("getFullObservations (Layer 3)", () => {
  test("returns full observation details by IDs", () => {
    // First search to get IDs
    const searchResults = searchObservations(db, "authentication");
    const ids = searchResults.map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);

    const fullResults = getFullObservations(db, ids);
    expect(fullResults.length).toBe(ids.length);
    // Full results should have raw_text, facts, etc.
    expect(fullResults[0]).toHaveProperty("raw_text");
    expect(fullResults[0]).toHaveProperty("facts");
    expect(fullResults[0]).toHaveProperty("narrative");
    expect(fullResults[0]).toHaveProperty("files_read");
    expect(fullResults[0]).toHaveProperty("files_modified");
  });

  test("returns empty array for empty IDs", () => {
    const fullResults = getFullObservations(db, []);
    expect(fullResults).toEqual([]);
  });
});

// ─── Layer 3: getFullSummaries ───────────────────────────────────────────────

describe("getFullSummaries (Layer 3)", () => {
  test("returns full summary details by IDs", () => {
    const searchResults = searchSummaries(db, "authentication");
    const ids = searchResults.map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);

    const fullResults = getFullSummaries(db, ids);
    expect(fullResults.length).toBe(ids.length);
    expect(fullResults[0]).toHaveProperty("request");
    expect(fullResults[0]).toHaveProperty("investigated");
    expect(fullResults[0]).toHaveProperty("learned");
    expect(fullResults[0]).toHaveProperty("completed");
    expect(fullResults[0]).toHaveProperty("next_steps");
  });

  test("returns empty array for empty IDs", () => {
    const fullResults = getFullSummaries(db, []);
    expect(fullResults).toEqual([]);
  });
});
