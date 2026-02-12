/**
 * Settings tests
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loadSettings, saveSettings, ensureSettingsFile, DEFAULT_SETTINGS, SETTINGS_FILE } from "../settings";

describe("Settings", () => {
  const testSettingsFile = join(homedir(), ".local", "share", "opencode", "opencode-mem", "settings.json");

  afterEach(() => {
    if (existsSync(testSettingsFile)) {
      rmSync(testSettingsFile, { force: true });
    }
  });

  test("loadSettings returns defaults when no file exists", () => {
    const settings = loadSettings();
    expect(settings.compression.enabled).toBe(true);
    expect(settings.viewer.port).toBe(37778);
    expect(settings.chroma.enabled).toBe(false);
  });

  test("saveSettings creates file", () => {
    const custom = {
      ...DEFAULT_SETTINGS,
      viewer: { ...DEFAULT_SETTINGS.viewer, port: 9999 },
    };
    saveSettings(custom);
    expect(existsSync(testSettingsFile)).toBe(true);
    
    const loaded = loadSettings();
    expect(loaded.viewer.port).toBe(9999);
  });

  test("ensureSettingsFile creates default settings", () => {
    ensureSettingsFile();
    expect(existsSync(testSettingsFile)).toBe(true);
  });

  test("DEFAULT_SETTINGS has expected structure", () => {
    expect(DEFAULT_SETTINGS.compression).toBeDefined();
    expect(DEFAULT_SETTINGS.context).toBeDefined();
    expect(DEFAULT_SETTINGS.viewer).toBeDefined();
    expect(DEFAULT_SETTINGS.chroma).toBeDefined();
    expect(DEFAULT_SETTINGS.privacy).toBeDefined();
    expect(DEFAULT_SETTINGS.logLevel).toBe("INFO");
  });
});
