import type { Database } from "./database";
import type { ObservationRow, SessionSummaryRow } from "../types/database";

export interface SearchOptions {
  project?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
  dateFrom?: number;
  dateTo?: number;
}

export interface LayerOneResult {
  id: number;
  type: "observation" | "summary" | "prompt";
  title: string | null;
  snippet: string;
  rank: number;
  session_id: string;
  created_at: number;
}

export interface TimelineEntry {
  id: number;
  type: string;
  title: string | null;
  subtitle: string | null;
  prompt_number: number | null;
  created_at: number;
}

export interface SessionListEntry {
  id: number;
  session_id: string;
  project: string;
  user_prompt: string;
  status: string;
  created_at: number;
  observation_count: number;
  first_observation_at: number | null;
  last_observation_at: number | null;
}

// ─── Layer 1: Search Index (IDs + snippets + scores) ─────────────────────────

function buildFilterClauses(
  tableAlias: string,
  options: SearchOptions,
): { whereClauses: string[]; params: unknown[] } {
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (options.project) {
    whereClauses.push(`${tableAlias}.project = ?`);
    params.push(options.project);
  }
  if (options.sessionId) {
    whereClauses.push(`${tableAlias}.session_id = ?`);
    params.push(options.sessionId);
  }
  if (options.dateFrom) {
    whereClauses.push(`${tableAlias}.created_at >= ?`);
    params.push(options.dateFrom);
  }
  if (options.dateTo) {
    whereClauses.push(`${tableAlias}.created_at <= ?`);
    params.push(options.dateTo);
  }

  return { whereClauses, params };
}

export function searchObservations(
  db: Database,
  query: string,
  options: SearchOptions = {},
): LayerOneResult[] {
  const { limit = 20, offset = 0 } = options;
  const { whereClauses, params } = buildFilterClauses("o", options);

  const allWhere = ["observations_fts MATCH ?", ...whereClauses].join(" AND ");
  const allParams = [query, ...params, limit, offset];

  const sql = `
    SELECT
      o.id,
      o.title,
      snippet(observations_fts, 2, '[', ']', '...', 20) AS snippet,
      observations_fts.rank,
      o.session_id,
      o.created_at
    FROM observations_fts
    JOIN observations o ON observations_fts.rowid = o.id
    WHERE ${allWhere}
    ORDER BY observations_fts.rank
    LIMIT ? OFFSET ?
  `;

  const rows = db.raw.prepare(sql).all(...allParams) as {
    id: number;
    title: string | null;
    snippet: string;
    rank: number;
    session_id: string;
    created_at: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    type: "observation" as const,
    title: r.title,
    snippet: r.snippet,
    rank: r.rank,
    session_id: r.session_id,
    created_at: r.created_at,
  }));
}

export function searchSummaries(
  db: Database,
  query: string,
  options: SearchOptions = {},
): LayerOneResult[] {
  const { limit = 20, offset = 0 } = options;
  const { whereClauses, params } = buildFilterClauses("s", options);

  const allWhere = ["session_summaries_fts MATCH ?", ...whereClauses].join(" AND ");
  const allParams = [query, ...params, limit, offset];

  const sql = `
    SELECT
      s.id,
      s.request AS title,
      snippet(session_summaries_fts, 0, '[', ']', '...', 20) AS snippet,
      session_summaries_fts.rank,
      s.session_id,
      s.created_at
    FROM session_summaries_fts
    JOIN session_summaries s ON session_summaries_fts.rowid = s.id
    WHERE ${allWhere}
    ORDER BY session_summaries_fts.rank
    LIMIT ? OFFSET ?
  `;

  const rows = db.raw.prepare(sql).all(...allParams) as {
    id: number;
    title: string | null;
    snippet: string;
    rank: number;
    session_id: string;
    created_at: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    type: "summary" as const,
    title: r.title,
    snippet: r.snippet,
    rank: r.rank,
    session_id: r.session_id,
    created_at: r.created_at,
  }));
}

export function searchUserPrompts(
  db: Database,
  query: string,
  options: SearchOptions = {},
): LayerOneResult[] {
  const { limit = 20, offset = 0 } = options;

  const whereClauses: string[] = ["user_prompts_fts MATCH ?"];
  const params: unknown[] = [query];
  let needsSessionJoin = false;

  if (options.project) {
    whereClauses.push("s.project = ?");
    params.push(options.project);
    needsSessionJoin = true;
  }
  if (options.sessionId) {
    whereClauses.push("p.session_id = ?");
    params.push(options.sessionId);
  }
  if (options.dateFrom) {
    whereClauses.push("p.created_at >= ?");
    params.push(options.dateFrom);
  }
  if (options.dateTo) {
    whereClauses.push("p.created_at <= ?");
    params.push(options.dateTo);
  }

  const sessionJoin = needsSessionJoin
    ? "JOIN sessions s ON p.session_id = s.session_id"
    : "";

  const sql = `
    SELECT
      p.id,
      NULL AS title,
      snippet(user_prompts_fts, 0, '[', ']', '...', 20) AS snippet,
      user_prompts_fts.rank,
      p.session_id,
      p.created_at
    FROM user_prompts_fts
    JOIN user_prompts p ON user_prompts_fts.rowid = p.id
    ${sessionJoin}
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY user_prompts_fts.rank
    LIMIT ? OFFSET ?
  `;

  const rows = db.raw.prepare(sql).all(...params, limit, offset) as {
    id: number;
    title: null;
    snippet: string;
    rank: number;
    session_id: string;
    created_at: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    type: "prompt" as const,
    title: r.title,
    snippet: r.snippet,
    rank: r.rank,
    session_id: r.session_id,
    created_at: r.created_at,
  }));
}

export function searchAll(
  db: Database,
  query: string,
  options: SearchOptions = {},
): LayerOneResult[] {
  const { limit = 20 } = options;

  const observations = searchObservations(db, query, { ...options, limit });
  const summaries = searchSummaries(db, query, { ...options, limit });
  const prompts = searchUserPrompts(db, query, { ...options, limit });

  return [...observations, ...summaries, ...prompts]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

// ─── Layer 2: Timeline Context ───────────────────────────────────────────────

export function getTimeline(db: Database, sessionId: string): TimelineEntry[] {
  const sql = `
    SELECT id, type, title, subtitle, prompt_number, created_at
    FROM observations
    WHERE session_id = ?
    ORDER BY created_at ASC
  `;
  return db.raw.prepare(sql).all(sessionId) as TimelineEntry[];
}

export function getSessionList(
  db: Database,
  options: { limit?: number; offset?: number; project?: string } = {},
): SessionListEntry[] {
  const { limit = 50, offset = 0, project } = options;

  let whereClause = "";
  const params: unknown[] = [];

  if (project) {
    whereClause = "WHERE s.project = ?";
    params.push(project);
  }

  const sql = `
    SELECT
      s.id,
      s.session_id,
      s.project,
      s.user_prompt,
      s.status,
      s.created_at,
      COUNT(o.id) AS observation_count,
      MIN(o.created_at) AS first_observation_at,
      MAX(o.created_at) AS last_observation_at
    FROM sessions s
    LEFT JOIN observations o ON s.session_id = o.session_id
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `;

  return db.raw.prepare(sql).all(...params, limit, offset) as SessionListEntry[];
}

// ─── Layer 3: Full Details by ID ─────────────────────────────────────────────

export function getFullObservations(db: Database, ids: number[]): ObservationRow[] {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const sql = `SELECT * FROM observations WHERE id IN (${placeholders}) ORDER BY created_at ASC`;
  return db.raw.prepare(sql).all(...ids) as ObservationRow[];
}

export function getFullSummaries(db: Database, ids: number[]): SessionSummaryRow[] {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const sql = `SELECT * FROM session_summaries WHERE id IN (${placeholders}) ORDER BY created_at ASC`;
  return db.raw.prepare(sql).all(...ids) as SessionSummaryRow[];
}
