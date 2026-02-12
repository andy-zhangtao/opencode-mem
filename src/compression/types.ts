export interface RawToolEvent {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: string;
  cwd: string;
  timestamp: number;
}

export interface ParsedObservation {
  type: string;
  title: string | null;
  subtitle: string | null;
  facts: string[];
  narrative: string | null;
  concepts: string[];
  files_read: string[];
  files_modified: string[];
}

export interface ParsedSummary {
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  notes: string | null;
}

export interface CompressionContext {
  project: string;
  userPrompt: string;
  sessionId: string;
}

export interface ICompressionEngine {
  compressObservation(
    events: RawToolEvent[],
    context: CompressionContext
  ): Promise<ParsedObservation[]>;

  generateSummary(
    sessionId: string,
    context: CompressionContext
  ): Promise<ParsedSummary>;

  isAvailable(): Promise<boolean>;
}
