import type { Database } from "../db/database";
import { insertUserPrompt, getSession, insertSession } from "../db/queries";
import { stripPrivateTags } from "./privacy";

const sessionPromptCounts = new Map<string, number>();

function ensureSession(db: Database, sessionId: string): void {
  const existing = getSession(db, sessionId);
  if (existing) return;
  
  try {
    insertSession(db, {
      session_id: sessionId,
      project: process.cwd(),
      user_prompt: "",
      status: "active",
    });
  } catch (err) {
    console.error("Failed to ensure session:", err);
  }
}

export async function chatMessage(
  input: { sessionID: string },
  output: {
    message: { role: string };
    parts: Array<{ type: string; text?: string }>;
  },
  db: Database
): Promise<void> {
  const sessionId = input.sessionID;

  ensureSession(db, sessionId);

  const textParts = output.parts.filter(
    (p): p is { type: "text"; text: string } =>
      p.type === "text" && typeof p.text === "string"
  );

  if (textParts.length === 0) return;

  const rawText = textParts.map((p) => p.text).join("\n");
  const cleaned = stripPrivateTags(rawText);

  const promptNumber = (sessionPromptCounts.get(sessionId) || 0) + 1;
  sessionPromptCounts.set(sessionId, promptNumber);

  try {
    insertUserPrompt(db, {
      session_id: sessionId,
      prompt_number: promptNumber,
      prompt_text: cleaned,
    });
  } catch (err) {
    console.error("Failed to write user_prompt:", err);
  }
}

export function _resetPromptCounts(): void {
  sessionPromptCounts.clear();
}
