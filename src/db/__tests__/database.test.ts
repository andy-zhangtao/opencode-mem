import { test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "../database";
import { unlinkSync } from "fs";
import type { TableInfo, JournalMode } from "../../types/database";

const TEST_DB_PATH = "/tmp/opencode-mem-test-db.sqlite";

let db: Database;

beforeAll(() => {
  try { unlinkSync(TEST_DB_PATH); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
  db = Database.create(TEST_DB_PATH);
});

afterAll(() => {
  db.close();
  try { unlinkSync(TEST_DB_PATH); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
  try { unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
});

test("database initializes successfully", () => {
  expect(db).toBeDefined();
  expect(db.raw).toBeDefined();
});

test("WAL mode is enabled", () => {
  const result = db.raw.query("PRAGMA journal_mode").get() as JournalMode;
  expect(result.journal_mode).toBe("wal");
});

test("all 5 regular tables exist", () => {
  const tables = db.raw
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as TableInfo[];
  const names = tables.map((t) => t.name);

  expect(names).toContain("sessions");
  expect(names).toContain("observations");
  expect(names).toContain("session_summaries");
  expect(names).toContain("user_prompts");
  expect(names).toContain("pending_compressions");
});

test("all 3 FTS5 virtual tables exist", () => {
  const tables = db.raw
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts'")
    .all() as TableInfo[];
  const names = tables.map((t) => t.name);

  expect(names).toContain("observations_fts");
  expect(names).toContain("session_summaries_fts");
  expect(names).toContain("user_prompts_fts");
});

test("singleton returns same instance", () => {
  const db2 = Database.create(TEST_DB_PATH);
  expect(db2).toBe(db);
});

test("foreign keys are enabled", () => {
  const result = db.raw.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
  expect(result.foreign_keys).toBe(1);
});
