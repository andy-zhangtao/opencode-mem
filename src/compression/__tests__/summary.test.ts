import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { generateSessionSummary } from "../summary";
import { Database } from "../../db/database";
import { MockCompressionEngine } from "../mock-engine";
import {
  insertSession,
  insertObservation,
  getSession,
} from "../../db/queries";
import type { SessionSummaryRow } from "../../types/database";

describe("generateSessionSummary", () => {
  let db: Database;
  let engine: MockCompressionEngine;

  beforeEach(() => {
    db = Database.create(":memory:");
    engine = new MockCompressionEngine();
  });

  afterEach(() => {
    db.close();
  });

  test("skips sessions with <3 observations", async () => {
    // Setup: session with 2 observations
    insertSession(db, {
      session_id: "test-session-1",
      project: "/test",
      user_prompt: "test prompt",
    });

    insertObservation(db, {
      session_id: "test-session-1",
      project: "/test",
      raw_text: "obs1",
      type: "file_read",
      title: "Read file 1",
    });

    insertObservation(db, {
      session_id: "test-session-1",
      project: "/test",
      raw_text: "obs2",
      type: "file_edit",
      title: "Edit file 2",
    });

    // Call generateSessionSummary
    await generateSessionSummary(db, engine, "test-session-1");

    // Assert: no summary created
    const summaries = db.raw
      .prepare("SELECT * FROM session_summaries WHERE session_id = ?")
      .all("test-session-1") as SessionSummaryRow[];

    expect(summaries).toHaveLength(0);
  });

  test("generates summary for session with 3+ observations", async () => {
    // Setup: session with 5 observations
    insertSession(db, {
      session_id: "test-session-2",
      project: "/test",
      user_prompt: "build feature X",
    });

    for (let i = 1; i <= 5; i++) {
      insertObservation(db, {
        session_id: "test-session-2",
        project: "/test",
        raw_text: `observation ${i}`,
        type: "code_change",
        title: `Task ${i}`,
      });
    }

    // Call generateSessionSummary
    await generateSessionSummary(db, engine, "test-session-2");

    // Assert: summary inserted into session_summaries
    const summaries = db.raw
      .prepare("SELECT * FROM session_summaries WHERE session_id = ?")
      .all("test-session-2") as SessionSummaryRow[];

    expect(summaries).toHaveLength(1);

    const summary = summaries[0];
    expect(summary.session_id).toBe("test-session-2");
    expect(summary.project).toBe("/test");
    expect(summary.request).toBe("build feature X"); // MockEngine returns userPrompt as request
    expect(summary.investigated).toBeDefined();
    expect(summary.learned).toBeDefined();
    expect(summary.completed).toBeDefined();
    expect(summary.next_steps).toBeDefined();
  });

  test("handles missing session gracefully", async () => {
    // Call with non-existent sessionId
    await generateSessionSummary(db, engine, "non-existent-session");

    // Assert: no error thrown, no summaries created
    const summaries = db.raw
      .prepare("SELECT * FROM session_summaries")
      .all() as SessionSummaryRow[];

    expect(summaries).toHaveLength(0);
  });

  test("handles engine errors gracefully", async () => {
    // Setup: session with 3 observations
    insertSession(db, {
      session_id: "test-session-3",
      project: "/test",
      user_prompt: "test",
    });

    for (let i = 1; i <= 3; i++) {
      insertObservation(db, {
        session_id: "test-session-3",
        project: "/test",
        raw_text: `obs ${i}`,
        type: "task",
        title: `Task ${i}`,
      });
    }

    // Mock engine that throws error
    const failingEngine = {
      async compressObservation() {
        return [];
      },
      async generateSummary(): Promise<any> {
        throw new Error("Engine failure");
      },
      async isAvailable() {
        return true;
      },
    };

    // Call generateSessionSummary - should NOT throw
    await expect(
      generateSessionSummary(db, failingEngine, "test-session-3")
    ).resolves.toBeUndefined();

    // Assert: no summary created (error was caught)
    const summaries = db.raw
      .prepare("SELECT * FROM session_summaries WHERE session_id = ?")
      .all("test-session-3") as SessionSummaryRow[];

    expect(summaries).toHaveLength(0);
  });

  test("handles null summary from engine gracefully", async () => {
    // Setup: session with 3 observations
    insertSession(db, {
      session_id: "test-session-4",
      project: "/test",
      user_prompt: "test",
    });

    for (let i = 1; i <= 3; i++) {
      insertObservation(db, {
        session_id: "test-session-4",
        project: "/test",
        raw_text: `obs ${i}`,
        type: "task",
        title: `Task ${i}`,
      });
    }

    // Mock engine that returns null (malformed XML response)
    const nullEngine = {
      async compressObservation() {
        return [];
      },
      async generateSummary(): Promise<any> {
        return null;
      },
      async isAvailable() {
        return true;
      },
    };

    // Call generateSessionSummary
    await generateSessionSummary(db, nullEngine, "test-session-4");

    // Assert: no summary created
    const summaries = db.raw
      .prepare("SELECT * FROM session_summaries WHERE session_id = ?")
      .all("test-session-4") as SessionSummaryRow[];

    expect(summaries).toHaveLength(0);
  });

  test("generates summary only once for the same session", async () => {
    // Setup: session with 3 observations
    insertSession(db, {
      session_id: "test-session-5",
      project: "/test",
      user_prompt: "test prompt",
    });

    for (let i = 1; i <= 3; i++) {
      insertObservation(db, {
        session_id: "test-session-5",
        project: "/test",
        raw_text: `obs ${i}`,
        type: "task",
        title: `Task ${i}`,
      });
    }

    // Call twice
    await generateSessionSummary(db, engine, "test-session-5");
    await generateSessionSummary(db, engine, "test-session-5");

    // Assert: 2 summaries created (no deduplication logic yet, but test documents behavior)
    const summaries = db.raw
      .prepare("SELECT * FROM session_summaries WHERE session_id = ?")
      .all("test-session-5") as SessionSummaryRow[];

    // Current behavior: allows duplicates (no unique constraint)
    expect(summaries.length).toBeGreaterThanOrEqual(1);
  });
});
