/**
 * HTTP Server tests
 *
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "../../db/database";
import { insertSession, insertObservation, insertSummary } from "../../db/queries";
import { startHTTPServer } from "../http";

describe("HTTP Server", () => {
  let db: Database;

  beforeEach(() => {
    db = Database.create(":memory:");
    insertSession(db, {
      session_id: "http-test-session",
      project: "http-project",
      user_prompt: "HTTP test",
      status: "active",
    });
    insertObservation(db, {
      session_id: "http-test-session",
      project: "http-project",
      raw_text: "Test observation",
      type: "tool_use",
      title: "Test Obs",
    });
  });

  afterEach(() => {
    db.close();
  });

  test("startHTTPServer is callable", () => {
    expect(() => startHTTPServer(db, 0)).not.toThrow();
  });
});

describe("HTTP API helpers", () => {
  let db: Database;

  beforeEach(() => {
    db = Database.create(":memory:");
    insertSession(db, {
      session_id: "api-test-session",
      project: "api-project",
      user_prompt: "API test",
      status: "active",
    });
    insertObservation(db, {
      session_id: "api-test-session",
      project: "api-project",
      raw_text: "API observation",
      type: "tool_use",
      title: "API Obs",
    });
    insertSummary(db, {
      session_id: "api-test-session",
      project: "api-project",
      request: "Test request",
      learned: "Test learned",
    });
  });

  afterEach(() => {
    db.close();
  });

  test("getSessionList returns sessions with observation counts", () => {
    const { getSessionList } = require("../../db/queries");
    const sessions = getSessionList(db);
    expect(sessions.length).toBe(1);
    expect(sessions[0].session_id).toBe("api-test-session");
    expect(sessions[0].observation_count).toBe(1);
  });

  test("getSessionObservations returns session observations", () => {
    const { getSessionObservations } = require("../../db/queries");
    const observations = getSessionObservations(db, "api-test-session");
    expect(observations.length).toBe(1);
    expect(observations[0].title).toBe("API Obs");
  });

  test("getStats returns correct counts", () => {
    const { getStats } = require("../../db/queries");
    const stats = getStats(db);
    expect(stats.sessions).toBe(1);
    expect(stats.observations).toBe(1);
    expect(stats.summaries).toBe(1);
  });

  test("getAllProjects returns unique projects", () => {
    const { getAllProjects } = require("../../db/queries");
    const projects = getAllProjects(db);
    expect(projects).toContain("api-project");
  });
});
