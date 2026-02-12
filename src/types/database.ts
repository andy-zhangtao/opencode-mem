// ─── Sessions ────────────────────────────────────────────────────────────────

export interface Session {
  id?: number;
  session_id: string;
  project: string;
  user_prompt: string;
  status?: "active" | "completed" | "failed";
  created_at?: number;
  updated_at?: number;
}

export interface SessionRow {
  id: number;
  session_id: string;
  project: string;
  user_prompt: string;
  status: string;
  created_at: number;
  updated_at: number;
}

// ─── Observations ────────────────────────────────────────────────────────────

export interface Observation {
  id?: number;
  session_id: string;
  project: string;
  raw_text: string;
  type: string;
  title: string;
  subtitle?: string | null;
  facts?: string[];
  narrative?: string | null;
  concepts?: string[];
  files_read?: string[];
  files_modified?: string[];
  prompt_number?: number;
  created_at?: number;
}

export interface ObservationRow {
  id: number;
  session_id: string;
  project: string;
  raw_text: string;
  type: string;
  title: string;
  subtitle: string | null;
  facts: string | null; // JSON string
  narrative: string | null;
  concepts: string | null; // JSON string
  files_read: string | null; // JSON string
  files_modified: string | null; // JSON string
  prompt_number: number | null;
  created_at: number;
}

// ─── Session Summaries ───────────────────────────────────────────────────────

export interface SessionSummary {
  id?: number;
  session_id: string;
  project: string;
  request?: string | null;
  investigated?: string | null;
  learned?: string | null;
  completed?: string | null;
  next_steps?: string | null;
  files_read?: string | null;
  files_edited?: string | null;
  notes?: string | null;
  prompt_number?: number;
  created_at?: number;
}

export interface SessionSummaryRow {
  id: number;
  session_id: string;
  project: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  files_read: string | null;
  files_edited: string | null;
  notes: string | null;
  prompt_number: number | null;
  created_at: number;
}

// ─── User Prompts ────────────────────────────────────────────────────────────

export interface UserPrompt {
  id?: number;
  session_id: string;
  prompt_number: number;
  prompt_text: string;
  created_at?: number;
}

export interface UserPromptRow {
  id: number;
  session_id: string;
  prompt_number: number;
  prompt_text: string;
  created_at: number;
}

// ─── Pending Compressions ────────────────────────────────────────────────────

export interface PendingCompression {
  id?: number;
  session_id: string;
  tool_name: string;
  tool_input?: string; // JSON string
  tool_output?: string;
  cwd?: string;
  status?: "pending" | "processing" | "processed" | "failed";
  retry_count?: number;
  created_at?: number;
}

export interface PendingCompressionRow {
  id: number;
  session_id: string;
  tool_name: string;
  tool_input: string | null;
  tool_output: string | null;
  cwd: string | null;
  status: string;
  retry_count: number;
  created_at: number;
}

// ─── Search Results ──────────────────────────────────────────────────────────

export interface SearchResult<T> {
  item: T;
  rank: number;
}

// ─── Table Info (SQLite introspection) ───────────────────────────────────────

export interface TableInfo {
  name: string;
}

export interface JournalMode {
  journal_mode: string;
}
