import { test, expect, describe } from "bun:test";
import { MockCompressionEngine } from "../mock-engine";
import type { RawToolEvent } from "../types";

describe("MockCompressionEngine", () => {
  test("implements ICompressionEngine interface", () => {
    const engine = new MockCompressionEngine();
    expect(engine.compressObservation).toBeDefined();
    expect(engine.generateSummary).toBeDefined();
    expect(engine.isAvailable).toBeDefined();
  });

  test("isAvailable returns true", async () => {
    const engine = new MockCompressionEngine();
    expect(await engine.isAvailable()).toBe(true);
  });

  describe("compressObservation", () => {
    test("returns valid ParsedObservation array", async () => {
      const engine = new MockCompressionEngine();
      const events: RawToolEvent[] = [
        {
          sessionId: "test-session",
          toolName: "bash",
          toolInput: { command: "ls" },
          toolOutput: "file1.txt\nfile2.txt",
          cwd: "/test",
          timestamp: Date.now(),
        },
      ];

      const result = await engine.compressObservation(events, {
        project: "/test",
        userPrompt: "list files",
        sessionId: "test-session",
      });

      expect(result).toBeArray();
      expect(result).toHaveLength(1);

      const obs = result[0];
      expect(obs).toHaveProperty("type");
      expect(obs).toHaveProperty("title");
      expect(obs).toHaveProperty("subtitle");
      expect(obs).toHaveProperty("facts");
      expect(obs).toHaveProperty("narrative");
      expect(obs).toHaveProperty("concepts");
      expect(obs).toHaveProperty("files_read");
      expect(obs).toHaveProperty("files_modified");

      expect(obs.facts).toBeArray();
      expect(obs.concepts).toBeArray();
      expect(obs.files_read).toBeArray();
      expect(obs.files_modified).toBeArray();
    });

    test("handles empty events array", async () => {
      const engine = new MockCompressionEngine();
      const result = await engine.compressObservation([], {
        project: "/test",
        userPrompt: "test",
        sessionId: "test",
      });

      expect(result).toBeArray();
      expect(result).toHaveLength(0);
    });

    test("handles multiple events", async () => {
      const engine = new MockCompressionEngine();
      const events: RawToolEvent[] = [
        {
          sessionId: "s1",
          toolName: "read",
          toolInput: { filePath: "/test/file1.txt" },
          toolOutput: "content1",
          cwd: "/test",
          timestamp: Date.now(),
        },
        {
          sessionId: "s1",
          toolName: "edit",
          toolInput: { filePath: "/test/file2.txt" },
          toolOutput: "edited",
          cwd: "/test",
          timestamp: Date.now() + 1000,
        },
      ];

      const result = await engine.compressObservation(events, {
        project: "/test",
        userPrompt: "edit files",
        sessionId: "s1",
      });

      expect(result).toHaveLength(2);
      expect(result[0].title).toContain("read");
      expect(result[1].title).toContain("edit");
    });
  });

  describe("generateSummary", () => {
    test("returns valid ParsedSummary", async () => {
      const engine = new MockCompressionEngine();
      const result = await engine.generateSummary("test-session", {
        project: "/test",
        userPrompt: "test prompt",
        sessionId: "test-session",
      });

      expect(result).toHaveProperty("request");
      expect(result).toHaveProperty("investigated");
      expect(result).toHaveProperty("learned");
      expect(result).toHaveProperty("completed");
      expect(result).toHaveProperty("next_steps");
      expect(result).toHaveProperty("notes");

      expect(typeof result.request).toBe("string");
      expect(typeof result.investigated === "string" || result.investigated === null).toBe(true);
      expect(typeof result.learned === "string" || result.learned === null).toBe(true);
      expect(typeof result.completed === "string" || result.completed === null).toBe(true);
      expect(typeof result.next_steps === "string" || result.next_steps === null).toBe(true);
      expect(typeof result.notes === "string" || result.notes === null).toBe(true);
    });

    test("includes userPrompt in request field", async () => {
      const engine = new MockCompressionEngine();
      const result = await engine.generateSummary("test-session", {
        project: "/test",
        userPrompt: "custom user prompt",
        sessionId: "test-session",
      });

      expect(result.request).toBe("custom user prompt");
    });
  });
});
