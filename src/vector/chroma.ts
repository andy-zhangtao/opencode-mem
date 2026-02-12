/**
 * Chroma Vector Search
 *
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Simplified version using HTTP API instead of MCP client.
 */

import type { Database } from "../db/database";
import { join } from "path";
import { homedir } from "os";

interface ChromaDocument {
  id: string;
  document: string;
  metadata: Record<string, string | number>;
}

interface ChromaQueryResult {
  ids: string[][];
  distances: number[][];
  metadatas: Record<string, any>[][];
  documents: string[][];
}

export interface VectorSearchResult {
  id: number;
  distance: number;
  metadata: Record<string, any>;
}

export class ChromaSync {
  private baseUrl: string;
  private collectionName: string;
  private project: string;
  private enabled: boolean;
  private db: Database;

  constructor(db: Database, project: string, host = "localhost:8000") {
    this.db = db;
    this.project = project;
    this.baseUrl = `http://${host}`;
    this.collectionName = `opencode_mem_${project.replace(/[^a-zA-Z0-9]/g, "_")}`;
    
    // Chroma disabled on Windows to prevent console popups
    this.enabled = process.platform !== "win32";
    
    if (!this.enabled) {
      console.error("[Chroma] Disabled on Windows");
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async request(endpoint: string, method = "GET", body?: unknown): Promise<unknown> {
    if (!this.enabled) {
      throw new Error("Chroma is disabled");
    }

    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`Chroma HTTP ${res.status}: ${await res.text()}`);
    }

    return res.json();
  }

  async ensureCollection(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.request(`/collections/${this.collectionName}`);
    } catch {
      // Collection doesn't exist, create it
      await this.request("/collections", "POST", {
        name: this.collectionName,
        metadata: { project: this.project },
      });
      console.error(`[Chroma] Created collection: ${this.collectionName}`);
    }
  }

  async addDocuments(documents: ChromaDocument[]): Promise<void> {
    if (!this.enabled || documents.length === 0) return;

    await this.ensureCollection();

    await this.request(`/collections/${this.collectionName}/add`, "POST", {
      ids: documents.map(d => d.id),
      documents: documents.map(d => d.document),
      metadatas: documents.map(d => d.metadata),
    });
  }

  async query(queryText: string, limit = 20): Promise<VectorSearchResult[]> {
    if (!this.enabled) return [];

    try {
      const result = (await this.request(
        `/collections/${this.collectionName}/query`,
        "POST",
        {
          query_texts: [queryText],
          n_results: limit,
          include: ["metadatas", "distances"],
        }
      )) as ChromaQueryResult;

      const ids = result.ids?.[0] || [];
      const distances = result.distances?.[0] || [];
      const metadatas = result.metadatas?.[0] || [];

      const results: VectorSearchResult[] = [];
      const seenIds = new Set<number>();

      for (let i = 0; i < ids.length; i++) {
        // Extract SQLite ID from document ID
        const match = ids[i].match(/(?:obs|summary|prompt)_(\d+)/);
        if (match) {
          const sqliteId = parseInt(match[1], 10);
          if (!seenIds.has(sqliteId)) {
            seenIds.add(sqliteId);
            results.push({
              id: sqliteId,
              distance: distances[i],
              metadata: metadatas[i] || {},
            });
          }
        }
      }

      return results;
    } catch (err) {
      console.error("[Chroma] Query error:", err);
      return [];
    }
  }

  async syncObservation(
    observationId: number,
    sessionId: string,
    type: string,
    title: string | null,
    narrative: string | null,
    facts: string[],
    createdAt: number
  ): Promise<void> {
    if (!this.enabled) return;

    const documents: ChromaDocument[] = [];
    const baseMetadata = {
      sqlite_id: observationId,
      doc_type: "observation",
      session_id: sessionId,
      project: this.project,
      type,
      title: title || "Untitled",
      created_at: createdAt,
    };

    // Narrative as document
    if (narrative) {
      documents.push({
        id: `obs_${observationId}_narrative`,
        document: narrative,
        metadata: { ...baseMetadata, field_type: "narrative" },
      });
    }

    // Each fact as document
    for (let i = 0; i < facts.length; i++) {
      documents.push({
        id: `obs_${observationId}_fact_${i}`,
        document: facts[i],
        metadata: { ...baseMetadata, field_type: "fact", fact_index: i },
      });
    }

    await this.addDocuments(documents);
  }

  async close(): Promise<void> {
    // No persistent connection to close in HTTP mode
  }
}

export async function isChromaAvailable(host = "localhost:8000"): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}/api/v1/heartbeat`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
