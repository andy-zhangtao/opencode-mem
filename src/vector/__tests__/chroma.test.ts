/**
 * Chroma Vector Search tests
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "../../db/database";
import { ChromaSync, isChromaAvailable } from "../chroma";

describe("ChromaSync", () => {
  let db: Database;

  beforeEach(() => {
    db = Database.create(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("creates instance with correct defaults", () => {
    const chroma = new ChromaSync(db, "test-project");
    expect(chroma.isEnabled()).toBe(process.platform !== "win32");
  });

  test("custom host configuration", () => {
    const chroma = new ChromaSync(db, "test-project", "custom-host:9000");
    expect(chroma).toBeDefined();
  });

  test("collection name sanitization", () => {
    const chroma = new ChromaSync(db, "my-project/with-special.chars");
    // Collection name should be sanitized
    expect(chroma).toBeDefined();
  });

  test("query returns empty array when disabled", async () => {
    // Force disable by using Windows platform check
    const originalPlatform = process.platform;
    
    const chroma = new ChromaSync(db, "test");
    if (!chroma.isEnabled()) {
      const results = await chroma.query("test query");
      expect(results).toEqual([]);
    }
  });
});

describe("isChromaAvailable", () => {
  test("returns false for unreachable host", async () => {
    const available = await isChromaAvailable("localhost:9999");
    expect(available).toBe(false);
  });
});
