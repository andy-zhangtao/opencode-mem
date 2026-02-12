/**
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem with multi-provider support.
 */

import type { RawToolEvent, CompressionContext } from "./types";

const OBSERVATION_TYPES = [
  "tool_use",
  "code_change",
  "discovery",
  "decision",
  "error_recovery",
];

const TYPE_DEFINITIONS = {
  tool_use: "Tool was invoked (read, write, bash, etc.)",
  code_change: "Code was modified in a file",
  discovery: "New information was learned about the codebase",
  decision: "An architectural or design choice was made",
  error_recovery: "An error was encountered and resolved",
};

export function buildObservationPrompt(
  events: RawToolEvent[],
  context: CompressionContext
): string {
  const eventsXml = events
    .map(
      (evt) => `<event>
  <tool>${escapeXml(evt.toolName)}</tool>
  <timestamp>${new Date(evt.timestamp).toISOString()}</timestamp>
  <cwd>${escapeXml(evt.cwd)}</cwd>
  <input>${escapeXml(JSON.stringify(evt.toolInput, null, 2))}</input>
  <output>${escapeXml(truncateOutput(evt.toolOutput))}</output>
</event>`
    )
    .join("\n\n");

  const typeDescriptions = OBSERVATION_TYPES.map(
    t => `- ${t}: ${TYPE_DEFINITIONS[t as keyof typeof TYPE_DEFINITIONS]}`
  ).join("\n");

  return `Compress these tool events into searchable observations.

<context>
  <user_request>${escapeXml(context.userPrompt)}</user_request>
  <project>${escapeXml(context.project)}</project>
  <date>${new Date().toISOString().split("T")[0]}</date>
</context>

<events>
${eventsXml}
</events>

Task: Analyze events and output one <observation> per logical work unit.

Observation types:
${typeDescriptions}

Output XML format:
<observation>
  <type>tool_use|code_change|discovery|decision|error_recovery</type>
  <title>Concise action description (5-10 words)</title>
  <subtitle>Context: file, function, or component</subtitle>
  <facts><fact>Specific verifiable detail</fact></facts>
  <narrative>What happened, why it matters, outcome</narrative>
  <concepts><concept>searchable-term</concept></concepts>
  <files_read><file>path</file></files_read>
  <files_modified><file>path</file></files_modified>
</observation>

Guidelines:
- Group related tool calls into one observation
- title: Start with verb (Added, Fixed, Refactored, Discovered)
- narrative: 1-3 sentences, include key details
- concepts: Lowercase, hyphenated (react-hooks, jwt-auth)
- Skip trivial operations (ls, pwd, simple reads)
- Extract file paths from tool input/output`;
}

export function buildSummaryPrompt(
  sessionId: string,
  context: CompressionContext
): string {
  return `Summarize this coding session for future reference.

<context>
  <session_id>${sessionId}</session_id>
  <project>${escapeXml(context.project)}</project>
  <user_request>${escapeXml(context.userPrompt)}</user_request>
</context>

Output XML format:
<summary>
  <request>What the user asked for (1 sentence)</request>
  <investigated>Files, modules, or concepts explored</investigated>
  <learned>Key discoveries or insights</learned>
  <completed>What was actually implemented or fixed</completed>
  <next_steps>Suggested follow-up actions</next_steps>
  <notes>Important context (decisions, blockers, dependencies)</notes>
</summary>

If session had no significant work, output:
<skip_summary reason="brief explanation" />

Guidelines:
- Be specific: include file names, function names, error messages
- learned: Non-obvious findings that future sessions might need
- completed: Concrete outcomes, not intentions
- next_steps: Actionable items, not vague ideas
- Keep each field 1-3 sentences`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateOutput(output: string, maxLength: number = 10000): string {
  if (output.length <= maxLength) return output;
  return output.slice(0, maxLength) + "\n... [truncated]";
}
