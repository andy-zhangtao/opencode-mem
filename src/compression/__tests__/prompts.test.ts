import { test, expect, describe } from "bun:test";
import { buildObservationPrompt, buildSummaryPrompt } from "../prompts";
import type { RawToolEvent, CompressionContext } from "../types";

describe("buildObservationPrompt", () => {
  const baseContext: CompressionContext = {
    project: "/test/project",
    userPrompt: "list files",
    sessionId: "test-session-123",
  };

  test("includes tool name and input parameters", () => {
    const events: RawToolEvent[] = [
      {
        sessionId: "test-session",
        toolName: "bash",
        toolInput: { command: "ls -la" },
        toolOutput: "file1.txt\nfile2.txt",
        cwd: "/test",
        timestamp: Date.now(),
      },
    ];

    const prompt = buildObservationPrompt(events, baseContext);

    expect(prompt).toContain("bash");
    expect(prompt).toContain("ls -la");
  });

  test("includes XML observation format instruction", () => {
    const events: RawToolEvent[] = [
      {
        sessionId: "s1",
        toolName: "read",
        toolInput: { filePath: "/test/file.ts" },
        toolOutput: "content",
        cwd: "/test",
        timestamp: Date.now(),
      },
    ];

    const prompt = buildObservationPrompt(events, baseContext);

    expect(prompt).toContain("<observation>");
    expect(prompt).toContain("<type>");
    expect(prompt).toContain("<title>");
    expect(prompt).toContain("<facts>");
    expect(prompt).toContain("<narrative>");
    expect(prompt).toContain("<concepts>");
    expect(prompt).toContain("<files_read>");
    expect(prompt).toContain("<files_modified>");
  });

  test("includes user request context", () => {
    const events: RawToolEvent[] = [
      {
        sessionId: "s1",
        toolName: "bash",
        toolInput: { command: "echo hello" },
        toolOutput: "hello",
        cwd: "/test",
        timestamp: Date.now(),
      },
    ];

    const prompt = buildObservationPrompt(events, baseContext);

    expect(prompt).toContain("list files");
  });

  test("includes working directory when present", () => {
    const events: RawToolEvent[] = [
      {
        sessionId: "s1",
        toolName: "bash",
        toolInput: { command: "pwd" },
        toolOutput: "/test/project",
        cwd: "/test/project",
        timestamp: Date.now(),
      },
    ];

    const prompt = buildObservationPrompt(events, baseContext);

    expect(prompt).toContain("/test/project");
  });

  test("handles multiple events", () => {
    const events: RawToolEvent[] = [
      {
        sessionId: "s1",
        toolName: "read",
        toolInput: { filePath: "/a.ts" },
        toolOutput: "content-a",
        cwd: "/test",
        timestamp: Date.now(),
      },
      {
        sessionId: "s1",
        toolName: "edit",
        toolInput: { filePath: "/b.ts", oldString: "x", newString: "y" },
        toolOutput: "edited",
        cwd: "/test",
        timestamp: Date.now() + 1000,
      },
    ];

    const prompt = buildObservationPrompt(events, baseContext);

    expect(prompt).toContain("read");
    expect(prompt).toContain("edit");
    expect(prompt).toContain("/a.ts");
    expect(prompt).toContain("/b.ts");
  });

  test("handles empty events array gracefully", () => {
    const prompt = buildObservationPrompt([], baseContext);

    expect(typeof prompt).toBe("string");
    expect(prompt).toContain("<observation>");
  });

  test("serializes complex tool input as JSON", () => {
    const events: RawToolEvent[] = [
      {
        sessionId: "s1",
        toolName: "edit",
        toolInput: {
          filePath: "/test/file.ts",
          oldString: "const x = 1;",
          newString: "const x = 2;",
        },
        toolOutput: "success",
        cwd: "/test",
        timestamp: Date.now(),
      },
    ];

    const prompt = buildObservationPrompt(events, baseContext);

    expect(prompt).toContain("const x = 1;");
    expect(prompt).toContain("const x = 2;");
  });

  test("includes timestamp information", () => {
    const now = Date.now();
    const events: RawToolEvent[] = [
      {
        sessionId: "s1",
        toolName: "bash",
        toolInput: { command: "date" },
        toolOutput: "today",
        cwd: "/test",
        timestamp: now,
      },
    ];

    const prompt = buildObservationPrompt(events, baseContext);

    const isoDate = new Date(now).toISOString();
    expect(prompt).toContain(isoDate.split("T")[0]);
  });
});

describe("buildSummaryPrompt", () => {
  const baseContext: CompressionContext = {
    project: "/test/project",
    userPrompt: "implement feature X",
    sessionId: "test-session-456",
  };

  test("includes session identifier", () => {
    const prompt = buildSummaryPrompt("test-session-456", baseContext);

    expect(prompt).toContain("test-session-456");
  });

  test("includes XML summary format instruction", () => {
    const prompt = buildSummaryPrompt("session-1", baseContext);

    expect(prompt).toContain("<summary>");
    expect(prompt).toContain("<request>");
    expect(prompt).toContain("<investigated>");
    expect(prompt).toContain("<learned>");
    expect(prompt).toContain("<completed>");
    expect(prompt).toContain("<next_steps>");
    expect(prompt).toContain("<notes>");
  });

  test("includes user prompt context", () => {
    const prompt = buildSummaryPrompt("session-1", baseContext);

    expect(prompt).toContain("implement feature X");
  });

  test("includes project context", () => {
    const prompt = buildSummaryPrompt("session-1", baseContext);

    expect(prompt).toContain("/test/project");
  });

  test("returns string prompt", () => {
    const prompt = buildSummaryPrompt("session-1", baseContext);

    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });
});
