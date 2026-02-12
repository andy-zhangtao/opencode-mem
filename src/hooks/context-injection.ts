import type { Database } from "../db/database";
import { getRecentObservations, getSessionProject } from "../db/queries";
import type { ObservationRow } from "../types/database";

export interface ContextOptions {
  maxTokens?: number;
  maxObservations?: number;
}

const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_MAX_OBSERVATIONS = 10;
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function formatObservation(obs: ObservationRow): string {
  const subtitle = obs.subtitle || obs.type;
  return `- **${obs.title}**: ${subtitle}`;
}

function buildContext(observations: ObservationRow[], maxTokens: number): string | null {
  const header = "## Memory from Previous Sessions\n\n### Recent Observations\n";
  let tokenBudget = maxTokens - estimateTokens(header);
  if (tokenBudget <= 0) return null;

  const lines: string[] = [];
  for (const obs of observations) {
    const line = formatObservation(obs);
    const cost = estimateTokens(line + "\n");
    if (cost > tokenBudget) break;
    lines.push(line);
    tokenBudget -= cost;
  }

  if (lines.length === 0) return null;
  return header + lines.join("\n");
}

export async function systemTransform(
  input: { sessionID?: string },
  output: { system: string[] },
  db: Database,
  options: ContextOptions = {}
): Promise<void> {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    maxObservations = DEFAULT_MAX_OBSERVATIONS,
  } = options;

  const sessionId = input.sessionID;
  if (!sessionId) return;

  const project = getSessionProject(db, sessionId);
  if (!project) return;

  const observations = getRecentObservations(db, project, maxObservations);
  if (observations.length === 0) return;

  const context = buildContext(observations, maxTokens);
  if (!context) return;

  output.system.push(context);
}
