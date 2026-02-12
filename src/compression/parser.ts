/**
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem with multi-provider support.
 */

import type { ParsedObservation, ParsedSummary } from "./types";

const DEFAULT_FALLBACK_TYPE = "tool_use";

export function parseObservations(text: string): ParsedObservation[] {
  const observations: ParsedObservation[] = [];

  const observationRegex = /<observation>([\s\S]*?)<\/observation>/g;

  let match;
  while ((match = observationRegex.exec(text)) !== null) {
    const obsContent = match[1];

    const type = extractField(obsContent, "type");
    const title = extractField(obsContent, "title");
    const subtitle = extractField(obsContent, "subtitle");
    const narrative = extractField(obsContent, "narrative");
    const facts = extractArrayElements(obsContent, "facts", "fact");
    const concepts = extractArrayElements(obsContent, "concepts", "concept");
    const files_read = extractArrayElements(obsContent, "files_read", "file");
    const files_modified = extractArrayElements(
      obsContent,
      "files_modified",
      "file"
    );

    observations.push({
      type: type?.trim() || DEFAULT_FALLBACK_TYPE,
      title,
      subtitle,
      facts,
      narrative,
      concepts,
      files_read,
      files_modified,
    });
  }

  return observations;
}

export function parseSummary(text: string): ParsedSummary | null {
  const skipRegex = /<skip_summary\s+reason="([^"]+)"\s*\/>/;
  if (skipRegex.test(text)) {
    return null;
  }

  const summaryRegex = /<summary>([\s\S]*?)<\/summary>/;
  const summaryMatch = summaryRegex.exec(text);

  if (!summaryMatch) {
    return null;
  }

  const summaryContent = summaryMatch[1];

  return {
    request: extractField(summaryContent, "request"),
    investigated: extractField(summaryContent, "investigated"),
    learned: extractField(summaryContent, "learned"),
    completed: extractField(summaryContent, "completed"),
    next_steps: extractField(summaryContent, "next_steps"),
    notes: extractField(summaryContent, "notes"),
  };
}

function extractField(content: string, fieldName: string): string | null {
  const regex = new RegExp(`<${fieldName}>([\\s\\S]*?)</${fieldName}>`);
  const match = regex.exec(content);
  if (!match) return null;

  const trimmed = match[1].trim();
  return trimmed === "" ? null : trimmed;
}

function extractArrayElements(
  content: string,
  arrayName: string,
  elementName: string
): string[] {
  const arrayRegex = new RegExp(`<${arrayName}>([\\s\\S]*?)</${arrayName}>`);
  const arrayMatch = arrayRegex.exec(content);

  if (!arrayMatch) return [];

  const arrayContent = arrayMatch[1];
  const elements: string[] = [];
  const elementRegex = new RegExp(
    `<${elementName}>([\\s\\S]*?)</${elementName}>`,
    "g"
  );

  let elementMatch;
  while ((elementMatch = elementRegex.exec(arrayContent)) !== null) {
    const trimmed = elementMatch[1].trim();
    if (trimmed) {
      elements.push(trimmed);
    }
  }

  return elements;
}
