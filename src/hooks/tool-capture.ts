import type { Database } from "../db/database";
import { insertPendingCompression, getSession, insertSession } from "../db/queries";

const MAX_OUTPUT_BYTES = 100_000;
const TRUNCATION_MARKER = "\n[TRUNCATED - output exceeds 100KB]";
const CACHE_TTL_MS = 60_000;
const CLEANUP_INTERVAL_MS = 30_000;

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

interface CachedToolInput {
  tool: string;
  args: any;
  timestamp: number;
}

const toolInputCache = new Map<string, CachedToolInput>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [callID, data] of toolInputCache.entries()) {
      if (now - data.timestamp > CACHE_TTL_MS) {
        toolInputCache.delete(callID);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    (cleanupTimer as NodeJS.Timeout).unref();
  }
}

export async function toolExecuteBefore(
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any }
): Promise<void> {
  ensureCleanupTimer();
  toolInputCache.set(input.callID, {
    tool: input.tool,
    args: output.args,
    timestamp: Date.now(),
  });
}

export async function toolExecuteAfter(
  input: { tool: string; sessionID: string; callID: string },
  output: { title: string; output: string; metadata: any },
  db: Database
): Promise<void> {
  const cached = toolInputCache.get(input.callID);
  if (!cached) return;

  toolInputCache.delete(input.callID);

  ensureSession(db, input.sessionID);

  let toolOutput = output.output;
  if (typeof toolOutput === "string" && toolOutput.length > MAX_OUTPUT_BYTES) {
    toolOutput = toolOutput.slice(0, MAX_OUTPUT_BYTES) + TRUNCATION_MARKER;
  }

  try {
    insertPendingCompression(db, {
      session_id: input.sessionID,
      tool_name: input.tool,
      tool_input: JSON.stringify(cached.args),
      tool_output: toolOutput,
      cwd: process.cwd(),
      status: "pending",
    });
  } catch (err) {
    console.error("Failed to write pending_compression:", err);
  }
}

export function _getCache(): Map<string, CachedToolInput> {
  return toolInputCache;
}

export function _clearCache(): void {
  toolInputCache.clear();
}
