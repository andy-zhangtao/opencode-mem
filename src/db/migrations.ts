import type { Database } from "bun:sqlite";

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      project TEXT NOT NULL,
      user_prompt TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'completed', 'failed')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project)");
  db.run("CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)");
  db.run("CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC)");

  db.run(`
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      raw_text TEXT,
      type TEXT NOT NULL,
      title TEXT,
      subtitle TEXT,
      facts TEXT,
      narrative TEXT,
      concepts TEXT,
      files_read TEXT,
      files_modified TEXT,
      prompt_number INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(session_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project)");
  db.run("CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type)");
  db.run("CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at DESC)");

  db.run(`
    CREATE TABLE IF NOT EXISTS session_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      request TEXT,
      investigated TEXT,
      learned TEXT,
      completed TEXT,
      next_steps TEXT,
      files_read TEXT,
      files_edited TEXT,
      notes TEXT,
      prompt_number INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_summaries_session ON session_summaries(session_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_summaries_project ON session_summaries(project)");
  db.run("CREATE INDEX IF NOT EXISTS idx_summaries_created ON session_summaries(created_at DESC)");

  db.run(`
    CREATE TABLE IF NOT EXISTS user_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      prompt_number INTEGER NOT NULL,
      prompt_text TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_prompts_session ON user_prompts(session_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_prompts_created ON user_prompts(created_at DESC)");
  db.run("CREATE INDEX IF NOT EXISTS idx_prompts_lookup ON user_prompts(session_id, prompt_number)");

  db.run(`
    CREATE TABLE IF NOT EXISTS pending_compressions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_input TEXT,
      tool_output TEXT,
      cwd TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_compressions_session ON pending_compressions(session_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_compressions_status ON pending_compressions(status)");

  createFTS5Tables(db);
}

function createFTS5Tables(db: Database): void {
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
      title, subtitle, narrative,
      content=observations,
      content_rowid=id
    )
  `);

  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
      request, investigated, learned, completed, next_steps,
      content=session_summaries,
      content_rowid=id
    )
  `);

  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS user_prompts_fts USING fts5(
      prompt_text,
      content=user_prompts,
      content_rowid=id
    )
  `);

  createFTSTriggers(db);
}

function createFTSTriggers(db: Database): void {
  // ── Observations FTS triggers ──
  db.run(`
    CREATE TRIGGER IF NOT EXISTS observations_fts_ai AFTER INSERT ON observations BEGIN
      INSERT INTO observations_fts(rowid, title, subtitle, narrative)
      VALUES (new.id, new.title, new.subtitle, new.narrative);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS observations_fts_ad AFTER DELETE ON observations BEGIN
      INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative)
      VALUES('delete', old.id, old.title, old.subtitle, old.narrative);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS observations_fts_au AFTER UPDATE ON observations BEGIN
      INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative)
      VALUES('delete', old.id, old.title, old.subtitle, old.narrative);
      INSERT INTO observations_fts(rowid, title, subtitle, narrative)
      VALUES (new.id, new.title, new.subtitle, new.narrative);
    END
  `);

  // Session summaries FTS triggers
  db.run(`
    CREATE TRIGGER IF NOT EXISTS summaries_fts_ai AFTER INSERT ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps)
      VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS summaries_fts_ad AFTER DELETE ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps)
      VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS summaries_fts_au AFTER UPDATE ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps)
      VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps);
      INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps)
      VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps);
    END
  `);

  // User prompts FTS triggers
  db.run(`
    CREATE TRIGGER IF NOT EXISTS prompts_fts_ai AFTER INSERT ON user_prompts BEGIN
      INSERT INTO user_prompts_fts(rowid, prompt_text)
      VALUES (new.id, new.prompt_text);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS prompts_fts_ad AFTER DELETE ON user_prompts BEGIN
      INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
      VALUES('delete', old.id, old.prompt_text);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS prompts_fts_au AFTER UPDATE ON user_prompts BEGIN
      INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
      VALUES('delete', old.id, old.prompt_text);
      INSERT INTO user_prompts_fts(rowid, prompt_text)
      VALUES (new.id, new.prompt_text);
    END
  `);
}
