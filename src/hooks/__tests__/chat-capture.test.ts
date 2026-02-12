import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { chatMessage, _resetPromptCounts } from "../chat-capture";
import { Database } from "../../db/database";
import { insertSession } from "../../db/queries";

let db: Database;

beforeEach(() => {
  Database.resetAll();
  db = Database.create(":memory:");
  _resetPromptCounts();
  insertSession(db, {
    session_id: "test-session",
    project: "/test",
    user_prompt: "",
    status: "active",
  });
});

afterEach(() => {
  Database.resetAll();
});

describe("chatMessage", () => {
  test("captures user message text from parts", async () => {
    const input = {
      sessionID: "test-session",
    };
    const output = {
      message: {
        id: "msg-1",
        sessionID: "test-session",
        role: "user" as const,
        time: { created: Date.now() },
        agent: "default",
        model: { providerID: "anthropic", modelID: "claude-4" },
      },
      parts: [
        {
          id: "part-1",
          sessionID: "test-session",
          messageID: "msg-1",
          type: "text" as const,
          text: "Hello, help me with this code",
        },
      ],
    };

    await chatMessage(input, output, db);

    const rows = db.raw
      .prepare("SELECT * FROM user_prompts WHERE session_id = ?")
      .all("test-session") as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].prompt_text).toBe("Hello, help me with this code");
    expect(rows[0].prompt_number).toBe(1);
  });

  test("increments prompt_number per session", async () => {
    const makeOutput = (text: string) => ({
      message: {
        id: "msg-1",
        sessionID: "test-session",
        role: "user" as const,
        time: { created: Date.now() },
        agent: "default",
        model: { providerID: "anthropic", modelID: "claude-4" },
      },
      parts: [
        {
          id: "part-1",
          sessionID: "test-session",
          messageID: "msg-1",
          type: "text" as const,
          text,
        },
      ],
    });

    await chatMessage({ sessionID: "test-session" }, makeOutput("first"), db);
    await chatMessage({ sessionID: "test-session" }, makeOutput("second"), db);

    const rows = db.raw
      .prepare(
        "SELECT * FROM user_prompts WHERE session_id = ? ORDER BY prompt_number"
      )
      .all("test-session") as any[];
    expect(rows.length).toBe(2);
    expect(rows[0].prompt_number).toBe(1);
    expect(rows[1].prompt_number).toBe(2);
  });

  test("strips private tags from prompt text", async () => {
    const output = {
      message: {
        id: "msg-1",
        sessionID: "test-session",
        role: "user" as const,
        time: { created: Date.now() },
        agent: "default",
        model: { providerID: "anthropic", modelID: "claude-4" },
      },
      parts: [
        {
          id: "part-1",
          sessionID: "test-session",
          messageID: "msg-1",
          type: "text" as const,
          text: "Please help <private>my API key is sk-123</private> with auth",
        },
      ],
    };

    await chatMessage({ sessionID: "test-session" }, output, db);

    const rows = db.raw
      .prepare("SELECT * FROM user_prompts WHERE session_id = ?")
      .all("test-session") as any[];
    expect(rows[0].prompt_text).toBe("Please help  with auth");
    expect(rows[0].prompt_text).not.toContain("sk-123");
  });

  test("concatenates multiple text parts", async () => {
    const output = {
      message: {
        id: "msg-1",
        sessionID: "test-session",
        role: "user" as const,
        time: { created: Date.now() },
        agent: "default",
        model: { providerID: "anthropic", modelID: "claude-4" },
      },
      parts: [
        {
          id: "part-1",
          sessionID: "test-session",
          messageID: "msg-1",
          type: "text" as const,
          text: "First part",
        },
        {
          id: "part-2",
          sessionID: "test-session",
          messageID: "msg-1",
          type: "text" as const,
          text: "Second part",
        },
      ],
    };

    await chatMessage({ sessionID: "test-session" }, output, db);

    const rows = db.raw
      .prepare("SELECT * FROM user_prompts WHERE session_id = ?")
      .all("test-session") as any[];
    expect(rows[0].prompt_text).toBe("First part\nSecond part");
  });

  test("skips non-text parts", async () => {
    const output = {
      message: {
        id: "msg-1",
        sessionID: "test-session",
        role: "user" as const,
        time: { created: Date.now() },
        agent: "default",
        model: { providerID: "anthropic", modelID: "claude-4" },
      },
      parts: [
        {
          id: "part-1",
          sessionID: "test-session",
          messageID: "msg-1",
          type: "text" as const,
          text: "Only text",
        },
        {
          id: "part-2",
          sessionID: "test-session",
          messageID: "msg-1",
          type: "tool-invocation" as any,
          toolCallId: "call-1",
        },
      ],
    };

    await chatMessage({ sessionID: "test-session" }, output, db);

    const rows = db.raw
      .prepare("SELECT * FROM user_prompts WHERE session_id = ?")
      .all("test-session") as any[];
    expect(rows[0].prompt_text).toBe("Only text");
  });

  test("skips empty text content", async () => {
    const output = {
      message: {
        id: "msg-1",
        sessionID: "test-session",
        role: "user" as const,
        time: { created: Date.now() },
        agent: "default",
        model: { providerID: "anthropic", modelID: "claude-4" },
      },
      parts: [] as any[],
    };

    await chatMessage({ sessionID: "test-session" }, output, db);

    const rows = db.raw
      .prepare("SELECT * FROM user_prompts WHERE session_id = ?")
      .all("test-session") as any[];
    expect(rows.length).toBe(0);
  });
});
