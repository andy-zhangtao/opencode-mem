/**
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem: Direct SQLite access. Uses search.ts getFullObservations()
 * for batch fetching observation details by IDs.
 */

import type { Database } from "../../db/database";
import { getFullObservations, getFullSummaries } from "../../db/search";

export interface GetObservationsArgs {
  ids: number[];
  type?: "observation" | "summary";
}

export function getObservationsTool(db: Database, args: GetObservationsArgs): string {
  if (!args.ids || !Array.isArray(args.ids) || args.ids.length === 0) {
    throw new Error("'ids' parameter is required and must be a non-empty array of numbers");
  }

  // Validate all IDs are numbers
  for (const id of args.ids) {
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new Error(`Invalid ID: ${id}. All IDs must be integers.`);
    }
  }

  const fetchType = args.type ?? "observation";

  if (fetchType === "summary") {
    const summaries = getFullSummaries(db, args.ids);
    return JSON.stringify(
      {
        type: "summary",
        total: summaries.length,
        items: summaries,
      },
      null,
      2,
    );
  }

  const observations = getFullObservations(db, args.ids);
  return JSON.stringify(
    {
      type: "observation",
      total: observations.length,
      items: observations,
    },
    null,
    2,
  );
}
