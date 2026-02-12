import type {
  ICompressionEngine,
  RawToolEvent,
  ParsedObservation,
  ParsedSummary,
  CompressionContext,
} from "./types";
import { buildObservationPrompt, buildSummaryPrompt } from "./prompts";
import { parseObservations, parseSummary } from "./parser";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { logger } from "../utils/logger";

const LOG_FILE = process.env.HOME + "/.local/share/opencode/opencode-mem/debug.log";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function debugLog(...args: any[]) {
  // Only write to file if logging is enabled via environment variable
  if (!process.env.OPENCODE_MEM_LOG) return;
  
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${args.join(" ")}\n`;
  try {
    if (!existsSync(dirname(LOG_FILE))) {
      mkdirSync(dirname(LOG_FILE), { recursive: true });
    }
    appendFileSync(LOG_FILE, msg);
  } catch {}
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isJsonParseError(error: unknown): boolean {
  if (error instanceof SyntaxError) {
    const msg = error.message.toLowerCase();
    return msg.includes("json") || msg.includes("eof") || msg.includes("parse");
  }
  return false;
}

export class OpencodeProviderEngine implements ICompressionEngine {
  constructor(private client: any, private directory: string) {}

  async isAvailable(): Promise<boolean> {
    return this.client != null;
  }

  async compressObservation(
    events: RawToolEvent[],
    context: CompressionContext
  ): Promise<ParsedObservation[]> {
    if (events.length === 0) return [];

    const promptText = buildObservationPrompt(events, context);
    const sessionId = events[0].sessionId;
    
    debugLog("[opencode-engine] Sending prompt, sessionId:", sessionId, "events:", events.length);
    debugLog("[opencode-engine] promptText length:", promptText.length);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        debugLog("[opencode-engine] Calling session.prompt with:", JSON.stringify({
          sessionId,
          directory: this.directory,
          promptLength: promptText.length
        }));
        
        const response = await this.client.session.prompt({
          path: { id: sessionId },
          query: { directory: this.directory },
          body: {
            parts: [{ type: "text", text: promptText }]
          }
        });
        
        debugLog("[opencode-engine] Got response type:", typeof response);
        debugLog("[opencode-engine] Response keys:", Object.keys(response || {}).join(","));
        
        if (response?.response) {
          const resp = response.response;
          debugLog("[opencode-engine] HTTP status:", resp.status);
          debugLog("[opencode-engine] Content-Type:", resp.headers?.get?.("Content-Type"));
          try {
            const text = await resp.text();
            debugLog("[opencode-engine] Response body (first 500):", text.slice(0, 500));
          } catch (e) {
            debugLog("[opencode-engine] Could not read response body:", e);
          }
        }
        
        if (response.error) {
          debugLog("[opencode-engine] API error:", response.error);
          // Silently skip - don't log to console to avoid UI pollution
          return [];
        }
        
        // Check for nested error in response structure
        if (response.data?.error) {
          debugLog("[opencode-engine] Nested API error:", response.data.error);
          return [];
        }
        
        const data = response.data || response;
        const parts = data.parts || [];
        const content = parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("") || "";
        debugLog("[opencode-engine] Extracted content length:", content.length, "preview:", content.slice(0, 200));
        
        const observations = parseObservations(content);
        debugLog("[opencode-engine] Parsed observations:", observations.length);
        return observations;
      } catch (error) {
        const isJsonError = isJsonParseError(error);
        
        if (isJsonError && attempt < MAX_RETRIES) {
          debugLog(`[opencode-engine] JSON parse error on attempt ${attempt + 1}/${MAX_RETRIES + 1}, retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        
        debugLog("[opencode-engine] ERROR:", error);
        debugLog("[opencode-engine] ERROR stack:", (error as Error).stack);
        
        if (isJsonError) {
          debugLog(`[opencode-engine] JSON parse error persisted after ${MAX_RETRIES} retries, skipping this observation`);
        }
        
        return [];
      }
    }
    
    return [];
  }

  async generateSummary(
    sessionId: string,
    context: CompressionContext
  ): Promise<ParsedSummary | null> {
    const promptText = buildSummaryPrompt(sessionId, context);
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.session.prompt({
          path: { id: sessionId },
          query: { directory: this.directory },
          body: {
            parts: [{ type: "text", text: promptText }]
          }
        });
        debugLog("[opencode-engine] generateSummary response keys:", Object.keys(response || {}).join(","));
        
        if (response.error) {
          debugLog("[opencode-engine] generateSummary API error:", response.error);
          return null;
        }
        
        const data = response.data || response;
        const parts = data.parts || [];
        const content = parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("") || "";
        return parseSummary(content) as ParsedSummary;
      } catch (error) {
        if (isJsonParseError(error) && attempt < MAX_RETRIES) {
          debugLog(`[opencode-engine] generateSummary: JSON parse error, retrying...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        debugLog("[opencode-engine] generateSummary ERROR:", error);
        return null;
      }
    }
    
    return null;
  }
}
