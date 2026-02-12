import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { systemTransform } from "../context-injection";
import { Database } from "../../db/database";
import { insertSession, insertObservation } from "../../db/queries";

let db: Database;

beforeEach(() => {
  Database.resetAll();
  db = Database.create(":memory:");
  insertSession(db, {
    session_id: "test-session",
    project: "/test/project",
    user_prompt: "",
    status: "active",
  });
});

afterEach(() => {
  Database.resetAll();
});

function seedObservations(count: number = 1) {
  for (let i = 0; i < count; i++) {
    insertObservation(db, {
      session_id: "test-session",
      project: "/test/project",
      raw_text: `implemented feature ${i}`,
      type: "feature",
      title: `Feature ${i}`,
      subtitle: `Added feature number ${i}`,
      narrative: `Detailed narrative about feature ${i}`,
    });
  }
}

describe("systemTransform", () => {
  test("appends context to output.system array", async () => {
    seedObservations(1);
    const input = { sessionID: "test-session" };
    const output = { system: ["Base system prompt"] };

    await systemTransform(input, output, db);

    expect(output.system.length).toBeGreaterThan(1);
    expect(output.system[1]).toContain("Memory from Previous Sessions");
  });

  test("includes observation titles in context", async () => {
    insertObservation(db, {
      session_id: "test-session",
      project: "/test/project",
      raw_text: "implemented authentication",
      type: "feature",
      title: "Auth Implementation",
      subtitle: "Added JWT authentication to API",
      narrative: "JWT auth narrative",
    });

    const input = { sessionID: "test-session" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db);

    expect(output.system.length).toBe(1);
    const context = output.system[0];
    expect(context).toContain("Auth Implementation");
  });

  test("includes observation subtitles in context", async () => {
    insertObservation(db, {
      session_id: "test-session",
      project: "/test/project",
      raw_text: "fixed login bug",
      type: "bugfix",
      title: "Login Fix",
      subtitle: "Resolved null pointer in auth handler",
      narrative: "Bug fix narrative",
    });

    const input = { sessionID: "test-session" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db);

    const context = output.system[0];
    expect(context).toContain("Resolved null pointer in auth handler");
  });

  test("respects token budget", async () => {
    seedObservations(20);

    const input = { sessionID: "test-session" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db, { maxTokens: 100 });

    if (output.system.length > 0) {
      const context = output.system[0];
      expect(context.length).toBeLessThan(100 * 4);
    }
  });

  test("handles no session data gracefully", async () => {
    const input = { sessionID: "nonexistent" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db);

    expect(output.system.length).toBe(0);
  });

  test("handles missing sessionID gracefully", async () => {
    const input = {} as any;
    const output = { system: [] as string[] };

    await systemTransform(input, output, db);

    expect(output.system.length).toBe(0);
  });

  test("preserves existing system prompts", async () => {
    seedObservations(1);
    const input = { sessionID: "test-session" };
    const output = { system: ["Existing prompt 1", "Existing prompt 2"] };

    await systemTransform(input, output, db);

    expect(output.system[0]).toBe("Existing prompt 1");
    expect(output.system[1]).toBe("Existing prompt 2");
    expect(output.system.length).toBe(3);
  });

  test("shows most recent observations first", async () => {
    insertObservation(db, {
      session_id: "test-session",
      project: "/test/project",
      raw_text: "old feature",
      type: "feature",
      title: "Old Feature",
      subtitle: "First one",
      narrative: "Old",
    });
    insertObservation(db, {
      session_id: "test-session",
      project: "/test/project",
      raw_text: "new feature",
      type: "feature",
      title: "New Feature",
      subtitle: "Second one",
      narrative: "New",
    });

    const input = { sessionID: "test-session" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db);

    const context = output.system[0];
    const newIdx = context.indexOf("New Feature");
    const oldIdx = context.indexOf("Old Feature");
    expect(newIdx).toBeLessThan(oldIdx);
  });

  test("limits to maxObservations when specified", async () => {
    seedObservations(10);

    const input = { sessionID: "test-session" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db, { maxObservations: 3 });

    const context = output.system[0];
    const matches = context.match(/\*\*Feature \d+\*\*/g) || [];
    expect(matches.length).toBeLessThanOrEqual(3);
  });

  test("cross-session context from same project", async () => {
    insertSession(db, {
      session_id: "other-session",
      project: "/test/project",
      user_prompt: "",
      status: "completed",
    });
    insertObservation(db, {
      session_id: "other-session",
      project: "/test/project",
      raw_text: "cross session observation",
      type: "feature",
      title: "Cross Session Work",
      subtitle: "Done in another session",
      narrative: "Cross session narrative",
    });

    const input = { sessionID: "test-session" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db);

    const context = output.system[0];
    expect(context).toContain("Cross Session Work");
  });

  test("default maxTokens is 2000", async () => {
    seedObservations(3);

    const input = { sessionID: "test-session" };
    const output = { system: [] as string[] };

    await systemTransform(input, output, db);

    if (output.system.length > 0) {
      const context = output.system[0];
      expect(context.length).toBeLessThan(2000 * 4);
    }
  });
});
