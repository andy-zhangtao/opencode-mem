import { test, expect, describe } from "bun:test";
import { OpencodeProviderEngine } from "../opencode-engine";
import type { RawToolEvent } from "../types";

describe("OpencodeProviderEngine", () => {
  // Mock LLM client that returns hardcoded XML responses
  const createMockClient = (xmlResponse: string) => ({
    session: {
      prompt: async (_text: string) => ({
        content: xmlResponse,
      }),
    },
  });

  describe("isAvailable", () => {
    test("returns true when provider is configured", async () => {
      const mockClient = createMockClient("");
      const engine = new OpencodeProviderEngine(mockClient);
      expect(await engine.isAvailable()).toBe(true);
    });

    test("returns false when provider is not configured", async () => {
      const engine = new OpencodeProviderEngine(null);
      expect(await engine.isAvailable()).toBe(false);
    });
  });

  describe("compressObservation", () => {
    test("compresses single event into ParsedObservation", async () => {
      const xmlResponse = `
        <observation>
          <type>tool_use</type>
          <title>Executed bash command</title>
          <subtitle>ls command</subtitle>
          <facts>
            <fact>Found 3 files</fact>
          </facts>
          <narrative>Listed directory contents</narrative>
          <concepts>
            <concept>file-system</concept>
          </concepts>
          <files_read></files_read>
          <files_modified></files_modified>
        </observation>
      `;

      const mockClient = createMockClient(xmlResponse);
      const engine = new OpencodeProviderEngine(mockClient);

      const events: RawToolEvent[] = [
        {
          sessionId: "test-session",
          toolName: "bash",
          toolInput: { command: "ls" },
          toolOutput: "file1.txt\nfile2.txt\nfile3.txt",
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
      expect(result[0].type).toBe("tool_use");
      expect(result[0].title).toBe("Executed bash command");
      expect(result[0].facts).toEqual(["Found 3 files"]);
      expect(result[0].narrative).toBe("Listed directory contents");
      expect(result[0].concepts).toEqual(["file-system"]);
    });

    test("compresses multiple events into multiple observations", async () => {
      const xmlResponse = `
        <observation>
          <type>tool_use</type>
          <title>Read config file</title>
          <facts><fact>Config has API key</fact></facts>
          <narrative>Examined configuration</narrative>
          <concepts><concept>configuration</concept></concepts>
          <files_read><file>config.json</file></files_read>
          <files_modified></files_modified>
        </observation>
        <observation>
          <type>code_change</type>
          <title>Updated handler</title>
          <facts><fact>Added error handling</fact></facts>
          <narrative>Modified request handler</narrative>
          <concepts><concept>error-handling</concept></concepts>
          <files_read></files_read>
          <files_modified><file>src/handler.ts</file></files_modified>
        </observation>
      `;

      const mockClient = createMockClient(xmlResponse);
      const engine = new OpencodeProviderEngine(mockClient);

      const events: RawToolEvent[] = [
        {
          sessionId: "s1",
          toolName: "read",
          toolInput: { filePath: "/test/config.json" },
          toolOutput: '{"apiKey": "secret"}',
          cwd: "/test",
          timestamp: Date.now(),
        },
        {
          sessionId: "s1",
          toolName: "edit",
          toolInput: { filePath: "/test/src/handler.ts" },
          toolOutput: "edited",
          cwd: "/test",
          timestamp: Date.now() + 1000,
        },
      ];

      const result = await engine.compressObservation(events, {
        project: "/test",
        userPrompt: "fix error handling",
        sessionId: "s1",
      });

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("tool_use");
      expect(result[0].title).toBe("Read config file");
      expect(result[1].type).toBe("code_change");
      expect(result[1].title).toBe("Updated handler");
      expect(result[1].files_modified).toEqual(["src/handler.ts"]);
    });

    test("handles malformed XML gracefully", async () => {
      const xmlResponse = "<observation><type>incomplete";

      const mockClient = createMockClient(xmlResponse);
      const engine = new OpencodeProviderEngine(mockClient);

      const events: RawToolEvent[] = [
        {
          sessionId: "test",
          toolName: "bash",
          toolInput: { command: "test" },
          toolOutput: "output",
          cwd: "/test",
          timestamp: Date.now(),
        },
      ];

      const result = await engine.compressObservation(events, {
        project: "/test",
        userPrompt: "test",
        sessionId: "test",
      });

      expect(result).toBeArray();
      expect(result).toHaveLength(0);
    });

    test("handles empty events array", async () => {
      const mockClient = createMockClient("");
      const engine = new OpencodeProviderEngine(mockClient);

      const result = await engine.compressObservation([], {
        project: "/test",
        userPrompt: "test",
        sessionId: "test",
      });

      expect(result).toBeArray();
      expect(result).toHaveLength(0);
    });

    test("LLM can choose to compress multiple events into single observation", async () => {
      const xmlResponse = `
        <observation>
          <type>tool_use</type>
          <title>File operations batch</title>
          <facts>
            <fact>Read 2 files</fact>
            <fact>Modified 1 file</fact>
          </facts>
          <narrative>Performed multiple file operations</narrative>
          <concepts><concept>file-management</concept></concepts>
          <files_read>
            <file>file1.txt</file>
            <file>file2.txt</file>
          </files_read>
          <files_modified><file>output.txt</file></files_modified>
        </observation>
      `;

      const mockClient = createMockClient(xmlResponse);
      const engine = new OpencodeProviderEngine(mockClient);

      const events: RawToolEvent[] = [
        {
          sessionId: "s1",
          toolName: "read",
          toolInput: { filePath: "file1.txt" },
          toolOutput: "content1",
          cwd: "/test",
          timestamp: Date.now(),
        },
        {
          sessionId: "s1",
          toolName: "read",
          toolInput: { filePath: "file2.txt" },
          toolOutput: "content2",
          cwd: "/test",
          timestamp: Date.now() + 100,
        },
        {
          sessionId: "s1",
          toolName: "write",
          toolInput: { filePath: "output.txt" },
          toolOutput: "written",
          cwd: "/test",
          timestamp: Date.now() + 200,
        },
      ];

      const result = await engine.compressObservation(events, {
        project: "/test",
        userPrompt: "process files",
        sessionId: "s1",
      });

      // LLM compressed 3 events into 1 observation
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("File operations batch");
      expect(result[0].files_read).toHaveLength(2);
      expect(result[0].files_modified).toHaveLength(1);
    });
  });

  describe("generateSummary", () => {
    test("generates valid ParsedSummary with all fields", async () => {
      const xmlResponse = `
        <summary>
          <request>Implement authentication</request>
          <investigated>Reviewed existing auth patterns</investigated>
          <learned>JWT tokens are standard practice</learned>
          <completed>Added login endpoint with JWT</completed>
          <next_steps>Add token refresh mechanism</next_steps>
          <notes>Consider rate limiting for login attempts</notes>
        </summary>
      `;

      const mockClient = createMockClient(xmlResponse);
      const engine = new OpencodeProviderEngine(mockClient);

      const result = await engine.generateSummary("test-session", {
        project: "/test",
        userPrompt: "add auth",
        sessionId: "test-session",
      });

      expect(result).toHaveProperty("request");
      expect(result).toHaveProperty("investigated");
      expect(result).toHaveProperty("learned");
      expect(result).toHaveProperty("completed");
      expect(result).toHaveProperty("next_steps");
      expect(result).toHaveProperty("notes");

      expect(result.request).toBe("Implement authentication");
      expect(result.investigated).toBe("Reviewed existing auth patterns");
      expect(result.learned).toBe("JWT tokens are standard practice");
      expect(result.completed).toBe("Added login endpoint with JWT");
      expect(result.next_steps).toBe("Add token refresh mechanism");
      expect(result.notes).toBe("Consider rate limiting for login attempts");
    });

    test("handles summary with partial data", async () => {
      const xmlResponse = `
        <summary>
          <request>Quick fix</request>
          <investigated></investigated>
          <learned></learned>
          <completed>Fixed typo</completed>
          <next_steps></next_steps>
          <notes></notes>
        </summary>
      `;

      const mockClient = createMockClient(xmlResponse);
      const engine = new OpencodeProviderEngine(mockClient);

      const result = await engine.generateSummary("test-session", {
        project: "/test",
        userPrompt: "fix typo",
        sessionId: "test-session",
      });

      expect(result.request).toBe("Quick fix");
      expect(result.investigated).toBeNull();
      expect(result.learned).toBeNull();
      expect(result.completed).toBe("Fixed typo");
      expect(result.next_steps).toBeNull();
      expect(result.notes).toBeNull();
    });

    test("handles malformed summary XML", async () => {
      const xmlResponse = "<summary><request>incomplete";

      const mockClient = createMockClient(xmlResponse);
      const engine = new OpencodeProviderEngine(mockClient);

      const result = await engine.generateSummary("test-session", {
        project: "/test",
        userPrompt: "test",
        sessionId: "test-session",
      });

      // Should return null or throw error (depends on implementation)
      expect(result).toBeNull();
    });
  });
});
