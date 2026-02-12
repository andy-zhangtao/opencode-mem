import type { Database } from "./database";
import type {
  Session,
  SessionRow,
  Observation,
  ObservationRow,
  SessionSummary,
  SessionSummaryRow,
  UserPrompt,
  UserPromptRow,
  PendingCompression,
  PendingCompressionRow,
  SearchResult,
} from "../types/database";

// ─── Sessions ────────────────────────────────────────────────────────────────

export function insertSession(db: Database, session: Session): number {
  const stmt = db.raw.prepare(`
    INSERT INTO sessions (session_id, project, user_prompt, status)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(
    session.session_id,
    session.project,
    session.user_prompt,
    session.status ?? "active"
  );
  return (db.raw.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
}

export function getSession(db: Database, sessionId: string): SessionRow | null {
  const stmt = db.raw.prepare("SELECT * FROM sessions WHERE session_id = ?");
  return (stmt.get(sessionId) as SessionRow) ?? null;
}

export function updateSession(
  db: Database,
  sessionId: string,
  updates: Partial<Pick<Session, "status" | "user_prompt">>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.user_prompt !== undefined) {
    sets.push("user_prompt = ?");
    values.push(updates.user_prompt);
  }

  sets.push("updated_at = unixepoch()");
  values.push(sessionId);

  db.raw.prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE session_id = ?`).run(...values);
}

// ─── Observations ────────────────────────────────────────────────────────────

export function insertObservation(db: Database, obs: Observation): number {
  const stmt = db.raw.prepare(`
    INSERT INTO observations (session_id, project, raw_text, type, title, subtitle,
      facts, narrative, concepts, files_read, files_modified, prompt_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    obs.session_id,
    obs.project,
    obs.raw_text,
    obs.type,
    obs.title,
    obs.subtitle ?? null,
    obs.facts ? JSON.stringify(obs.facts) : null,
    obs.narrative ?? null,
    obs.concepts ? JSON.stringify(obs.concepts) : null,
    obs.files_read ? JSON.stringify(obs.files_read) : null,
    obs.files_modified ? JSON.stringify(obs.files_modified) : null,
    obs.prompt_number ?? null
  );
  return (db.raw.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
}

export function searchObservations(
  db: Database,
  query: string,
  limit = 20
): SearchResult<ObservationRow>[] {
  const stmt = db.raw.prepare(`
    SELECT o.*, rank
    FROM observations_fts fts
    JOIN observations o ON o.id = fts.rowid
    WHERE observations_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  const rows = stmt.all(query, limit) as (ObservationRow & { rank: number })[];
  return rows.map((r) => ({ item: r, rank: r.rank }));
}

// ─── Session Summaries ───────────────────────────────────────────────────────

export function insertSummary(db: Database, summary: SessionSummary): number {
  const stmt = db.raw.prepare(`
    INSERT INTO session_summaries (session_id, project, request, investigated,
      learned, completed, next_steps, files_read, files_edited, notes, prompt_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    summary.session_id,
    summary.project,
    summary.request ?? null,
    summary.investigated ?? null,
    summary.learned ?? null,
    summary.completed ?? null,
    summary.next_steps ?? null,
    summary.files_read ?? null,
    summary.files_edited ?? null,
    summary.notes ?? null,
    summary.prompt_number ?? null
  );
  return (db.raw.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
}

export function searchSummaries(
  db: Database,
  query: string,
  limit = 20
): SearchResult<SessionSummaryRow>[] {
  const stmt = db.raw.prepare(`
    SELECT s.*, rank
    FROM session_summaries_fts fts
    JOIN session_summaries s ON s.id = fts.rowid
    WHERE session_summaries_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  const rows = stmt.all(query, limit) as (SessionSummaryRow & { rank: number })[];
  return rows.map((r) => ({ item: r, rank: r.rank }));
}

// ─── User Prompts ────────────────────────────────────────────────────────────

export function insertUserPrompt(db: Database, prompt: UserPrompt): number {
  const stmt = db.raw.prepare(`
    INSERT INTO user_prompts (session_id, prompt_number, prompt_text)
    VALUES (?, ?, ?)
  `);
  stmt.run(prompt.session_id, prompt.prompt_number, prompt.prompt_text);
  return (db.raw.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
}

export function searchUserPrompts(
  db: Database,
  query: string,
  limit = 20
): SearchResult<UserPromptRow>[] {
  const stmt = db.raw.prepare(`
    SELECT p.*, rank
    FROM user_prompts_fts fts
    JOIN user_prompts p ON p.id = fts.rowid
    WHERE user_prompts_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  const rows = stmt.all(query, limit) as (UserPromptRow & { rank: number })[];
  return rows.map((r) => ({ item: r, rank: r.rank }));
}

// ─── Recent Observations (for context injection) ────────────────────────────

export function getRecentObservations(
  db: Database,
  project: string,
  limit = 10
): ObservationRow[] {
  const stmt = db.raw.prepare(`
    SELECT * FROM observations
    WHERE project = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);
  return stmt.all(project, limit) as ObservationRow[];
}

export function getSessionProject(db: Database, sessionId: string): string | null {
  const stmt = db.raw.prepare("SELECT project FROM sessions WHERE session_id = ?");
  const row = stmt.get(sessionId) as { project: string } | null;
  return row?.project ?? null;
}

export function getObservationsCountBySession(db: Database, sessionId: string): number {
  const stmt = db.raw.prepare("SELECT COUNT(*) as count FROM observations WHERE session_id = ?");
  const row = stmt.get(sessionId) as { count: number } | null;
  return row?.count ?? 0;
}

// ─── Pending Compressions ───────────────────────────────────────────────────

export function insertPendingCompression(db: Database, comp: PendingCompression): number {
  const stmt = db.raw.prepare(`
    INSERT INTO pending_compressions (session_id, tool_name, tool_input, tool_output, cwd, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    comp.session_id,
    comp.tool_name,
    comp.tool_input ?? null,
    comp.tool_output ?? null,
    comp.cwd ?? null,
    comp.status ?? "pending"
  );
  return (db.raw.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
}

export function getPendingCompressions(db: Database, limit = 50): PendingCompressionRow[] {
  const stmt = db.raw.prepare(`
    SELECT * FROM pending_compressions
    WHERE status IN ('pending', 'processing')
    ORDER BY created_at ASC
    LIMIT ?
  `);
  return stmt.all(limit) as PendingCompressionRow[];
}

export function updateCompressionStatus(
  db: Database,
  id: number,
  status: "pending" | "processing" | "processed" | "failed"
): void {
  db.raw.prepare("UPDATE pending_compressions SET status = ? WHERE id = ?").run(status, id);
}

// ─── HTTP API Helpers ────────────────────────────────────────────────────────

export interface SessionListItem {
  session_id: string;
  project: string;
  user_prompt: string | null;
  status: string;
  created_at: number;
  observation_count: number;
}

export function getSessionList(
  db: Database,
  options: { limit?: number; offset?: number; project?: string } = {}
): SessionListItem[] {
  const { limit = 50, offset = 0, project } = options;
  const whereClause = project ? "WHERE s.project = ?" : "";
  const sql = `
    SELECT s.session_id, s.project, s.user_prompt, s.status, s.created_at,
           (SELECT COUNT(*) FROM observations o WHERE o.session_id = s.session_id) as observation_count
    FROM sessions s
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const params = project ? [project, limit, offset] : [limit, offset];
  return db.raw.prepare(sql).all(...params) as SessionListItem[];
}

export function getSessionObservations(db: Database, sessionId: string): ObservationRow[] {
  return db.raw.prepare(
    "SELECT * FROM observations WHERE session_id = ? ORDER BY created_at ASC"
  ).all(sessionId) as ObservationRow[];
}

export function getStats(db: Database): { sessions: number; observations: number; summaries: number; prompts: number } {
  const sessions = (db.raw.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number }).count;
  const observations = (db.raw.prepare("SELECT COUNT(*) as count FROM observations").get() as { count: number }).count;
  const summaries = (db.raw.prepare("SELECT COUNT(*) as count FROM session_summaries").get() as { count: number }).count;
  const prompts = (db.raw.prepare("SELECT COUNT(*) as count FROM user_prompts").get() as { count: number }).count;
  return { sessions, observations, summaries, prompts };
}

export function getAllProjects(db: Database): string[] {
  const rows = db.raw.prepare(
    "SELECT DISTINCT project FROM sessions ORDER BY project"
  ).all() as { project: string }[];
  return rows.map(r => r.project);
}
