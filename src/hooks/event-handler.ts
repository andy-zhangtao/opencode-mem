import type { Database } from "../db/database";
import { insertSession, getSession } from "../db/queries";

export async function sessionCreated(
  event: { type: string; properties: { info: { id: string; directory: string } } },
  db: Database
): Promise<void> {
  const sessionId = event.properties.info.id;

  const existing = getSession(db, sessionId);
  if (existing) return;

  try {
    insertSession(db, {
      session_id: sessionId,
      project: event.properties.info.directory || process.cwd(),
      user_prompt: "",
      status: "active",
    });
  } catch (err) {
    console.error("Failed to create session:", err);
  }
}
