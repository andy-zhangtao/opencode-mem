import { Database as BunSQLite } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { runMigrations } from "./migrations";

const DEFAULT_DB_PATH = `${process.env.HOME}/.local/share/opencode/opencode-mem/opencode-mem.db`;

const MMAP_SIZE = 256 * 1024 * 1024; // 256MB
const CACHE_SIZE = 10_000;

export class Database {
  private static instances = new Map<string, Database>();
  public raw: BunSQLite;

  private constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.raw = new BunSQLite(dbPath, { create: true, readwrite: true });

    this.raw.run("PRAGMA journal_mode = WAL");
    this.raw.run("PRAGMA synchronous = NORMAL");
    this.raw.run("PRAGMA foreign_keys = ON");
    this.raw.run("PRAGMA temp_store = memory");
    this.raw.run(`PRAGMA mmap_size = ${MMAP_SIZE}`);
    this.raw.run(`PRAGMA cache_size = ${CACHE_SIZE}`);

    runMigrations(this.raw);
  }

  static create(dbPath: string = DEFAULT_DB_PATH): Database {
    const existing = Database.instances.get(dbPath);
    if (existing) return existing;

    const instance = new Database(dbPath);
    Database.instances.set(dbPath, instance);
    return instance;
  }

  close(): void {
    this.raw.close();
    for (const [path, inst] of Database.instances) {
      if (inst === this) {
        Database.instances.delete(path);
        break;
      }
    }
  }

  static resetAll(): void {
    for (const inst of Database.instances.values()) {
      inst.raw.close();
    }
    Database.instances.clear();
  }
}
