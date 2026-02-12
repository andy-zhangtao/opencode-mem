import type { Database } from "../db/database";
import type {
  ICompressionEngine,
  RawToolEvent,
  CompressionContext,
} from "./types";
import type { PendingCompressionRow } from "../types/database";
import {
  getPendingCompressions,
  updateCompressionStatus,
  insertObservation,
  getSession,
} from "../db/queries";

const POLL_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;
const BATCH_LIMIT = 10;

function safeJsonParse(text: string | null, fallback: any): any {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Start background compression queue processor.
 * Fire-and-forget: returns immediately, runs async loop in background.
 */
export function startCompressionQueue(
  db: Database,
  engine: ICompressionEngine
): void {
  processQueue(db, engine);
}

async function processQueue(
  db: Database,
  engine: ICompressionEngine
): Promise<void> {
  while (true) {
    try {
      const pending = getPendingCompressions(db, BATCH_LIMIT);

      for (const record of pending) {
        await processOne(db, engine, record);
      }
    } catch (error) {
      console.error("[queue-processor] Poll cycle error:", error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

async function processOne(
  db: Database,
  engine: ICompressionEngine,
  record: PendingCompressionRow
): Promise<void> {
  try {
    updateCompressionStatus(db, record.id, "processing");

    const session = getSession(db, record.session_id);
    const project = session?.project ?? "unknown";
    const userPrompt = session?.user_prompt ?? "";

    const event: RawToolEvent = {
      sessionId: record.session_id,
      toolName: record.tool_name,
      toolInput: safeJsonParse(record.tool_input, {}),
      toolOutput: record.tool_output ?? "",
      cwd: record.cwd ?? "",
      timestamp: record.created_at,
    };

    const context: CompressionContext = {
      sessionId: record.session_id,
      project,
      userPrompt,
    };

    const observations = await engine.compressObservation([event], context);

    console.error(
      `[queue-processor] Record ${record.id}: got ${observations.length} observations`
    );

    for (const obs of observations) {
      insertObservation(db, {
        session_id: record.session_id,
        project,
        raw_text: record.tool_output ?? "",
        type: obs.type,
        title: obs.title ?? "Untitled",
        subtitle: obs.subtitle,
        facts: obs.facts,
        narrative: obs.narrative,
        concepts: obs.concepts,
        files_read: obs.files_read,
        files_modified: obs.files_modified,
      });
    }

    updateCompressionStatus(db, record.id, "processed");
  } catch (error) {
    const newRetryCount = record.retry_count + 1;
    const newStatus = newRetryCount >= MAX_RETRIES ? "failed" : "pending";

    db.raw
      .prepare(
        "UPDATE pending_compressions SET retry_count = ?, status = ? WHERE id = ?"
      )
      .run(newRetryCount, newStatus, record.id);

    console.error(
      `[queue-processor] Compression failed for record ${record.id} (attempt ${newRetryCount}/${MAX_RETRIES}):`,
      error
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
