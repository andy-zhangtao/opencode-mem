import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  toolExecuteBefore,
  toolExecuteAfter,
  _getCache,
  _clearCache,
} from "../tool-capture";
import { Database } from "../../db/database";
import { getPendingCompressions } from "../../db/queries";

let db: Database;

beforeEach(() => {
  _clearCache();
  Database.resetAll();
  db = Database.create(":memory:");
});

afterEach(() => {
  Database.resetAll();
});

describe("toolExecuteBefore", () => {
  test("caches tool args by callID", async () => {
    const input = {
      tool: "bash",
      sessionID: "test-session",
      callID: "call-123",
    };
    const output = { args: { command: "ls -la" } };

    await toolExecuteBefore(input, output);

    const cache = _getCache();
    expect(cache.has("call-123")).toBe(true);
    expect(cache.get("call-123")!.tool).toBe("bash");
    expect(cache.get("call-123")!.args).toEqual({ command: "ls -la" });
  });

  test("overwrites existing callID entry", async () => {
    const input = {
      tool: "bash",
      sessionID: "test-session",
      callID: "call-123",
    };

    await toolExecuteBefore(input, { args: { command: "ls" } });
    await toolExecuteBefore(input, { args: { command: "pwd" } });

    const cache = _getCache();
    expect(cache.get("call-123")!.args).toEqual({ command: "pwd" });
  });
});

describe("toolExecuteAfter", () => {
  test("merges cached before data and writes to pending_compressions", async () => {
    const callID = "call-456";
    const sessionID = "test-session";

    await toolExecuteBefore(
      { tool: "bash", sessionID, callID },
      { args: { command: "ls -la" } }
    );

    await toolExecuteAfter(
      { tool: "bash", sessionID, callID },
      { title: "List files", output: "total 8\ndrwxr-xr-x", metadata: {} },
      db
    );

    const rows = getPendingCompressions(db);
    expect(rows.length).toBe(1);
    expect(rows[0].session_id).toBe("test-session");
    expect(rows[0].tool_name).toBe("bash");
    expect(JSON.parse(rows[0].tool_input!)).toEqual({ command: "ls -la" });
    expect(rows[0].tool_output).toBe("total 8\ndrwxr-xr-x");
    expect(rows[0].status).toBe("pending");
  });

  test("removes callID from cache after processing", async () => {
    const callID = "call-789";
    await toolExecuteBefore(
      { tool: "bash", sessionID: "s1", callID },
      { args: { command: "echo hi" } }
    );
    await toolExecuteAfter(
      { tool: "bash", sessionID: "s1", callID },
      { title: "Echo", output: "hi", metadata: {} },
      db
    );

    const cache = _getCache();
    expect(cache.has(callID)).toBe(false);
  });

  test("silently skips when no cached before data", async () => {
    await toolExecuteAfter(
      { tool: "bash", sessionID: "s1", callID: "orphan-call" },
      { title: "Orphan", output: "data", metadata: {} },
      db
    );

    const rows = getPendingCompressions(db);
    expect(rows.length).toBe(0);
  });

  test("truncates output exceeding 100KB with marker", async () => {
    const callID = "call-big";
    await toolExecuteBefore(
      { tool: "bash", sessionID: "s1", callID },
      { args: { command: "cat bigfile" } }
    );

    const largeOutput = "A".repeat(150_000);
    await toolExecuteAfter(
      { tool: "bash", sessionID: "s1", callID },
      { title: "Big output", output: largeOutput, metadata: {} },
      db
    );

    const rows = getPendingCompressions(db);
    expect(rows.length).toBe(1);
    expect(rows[0].tool_output!.length).toBeLessThanOrEqual(
      100_000 + 50
    );
    expect(rows[0].tool_output).toContain("[TRUNCATED");
  });

  test("stores cwd from process.cwd()", async () => {
    const callID = "call-cwd";
    await toolExecuteBefore(
      { tool: "bash", sessionID: "s1", callID },
      { args: {} }
    );
    await toolExecuteAfter(
      { tool: "bash", sessionID: "s1", callID },
      { title: "Test", output: "ok", metadata: {} },
      db
    );

    const rows = getPendingCompressions(db);
    expect(rows[0].cwd).toBe(process.cwd());
  });
});

describe("cache cleanup", () => {
  test("_clearCache empties the cache", async () => {
    await toolExecuteBefore(
      { tool: "bash", sessionID: "s1", callID: "c1" },
      { args: {} }
    );
    expect(_getCache().size).toBe(1);

    _clearCache();
    expect(_getCache().size).toBe(0);
  });
});
