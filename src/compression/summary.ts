import type { Database } from "../db/database";
import type { ICompressionEngine } from "./types";
import { getSession, getObservationsCountBySession, insertSummary } from "../db/queries";

const MIN_OBSERVATIONS_FOR_SUMMARY = 3;

export async function generateSessionSummary(
  db: Database,
  engine: ICompressionEngine,
  sessionId: string
): Promise<void> {
  try {
    const session = getSession(db, sessionId);
    if (!session) {
      console.warn(`[summary] Session not found: ${sessionId}`);
      return;
    }

    const obsCount = getObservationsCountBySession(db, sessionId);
    if (obsCount < MIN_OBSERVATIONS_FOR_SUMMARY) {
      console.debug(`[summary] Skipping session with only ${obsCount} observations`);
      return;
    }

    const summary = await engine.generateSummary(sessionId, {
      sessionId,
      project: session.project,
      userPrompt: session.user_prompt ?? "",
    });

    if (!summary) {
      console.warn(`[summary] Engine returned null for session ${sessionId}`);
      return;
    }

    insertSummary(db, {
      session_id: sessionId,
      project: session.project,
      request: summary.request,
      investigated: summary.investigated,
      learned: summary.learned,
      completed: summary.completed,
      next_steps: summary.next_steps,
      files_read: null,
      files_edited: null,
      notes: summary.notes,
    });

    console.info(`[summary] Generated summary for session ${sessionId}`);
  } catch (error) {
    console.error(`[summary] Failed to generate summary for ${sessionId}:`, error);
  }
}
