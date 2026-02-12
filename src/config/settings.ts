/**
 * Settings management
 *
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export interface Settings {
  compression: {
    enabled: boolean;
    minToolOutputLength: number;
    maxTokens: number;
  };
  context: {
    enabled: boolean;
    maxTokens: number;
    observationCount: number;
  };
  viewer: {
    enabled: boolean;
    port: number;
  };
  chroma: {
    enabled: boolean;
    host: string;
  };
  privacy: {
    stripTags: boolean;
  };
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
}

const DEFAULT_SETTINGS: Settings = {
  compression: {
    enabled: true,
    minToolOutputLength: 100,
    maxTokens: 4000,
  },
  context: {
    enabled: true,
    maxTokens: 4000,
    observationCount: 50,
  },
  viewer: {
    enabled: true,
    port: 37778,
  },
  chroma: {
    enabled: false,
    host: "localhost:8000",
  },
  privacy: {
    stripTags: true,
  },
  logLevel: "INFO",
};

const SETTINGS_DIR = join(homedir(), ".local", "share", "opencode", "opencode-mem");
const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");

function getEnvBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() === "true" || val === "1";
}

function getEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getEnvString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function loadSettings(): Settings {
  let fileSettings: Partial<Settings> = {};

  if (existsSync(SETTINGS_FILE)) {
    try {
      const content = readFileSync(SETTINGS_FILE, "utf-8");
      fileSettings = JSON.parse(content);
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  const settings: Settings = {
    compression: {
      enabled: getEnvBool("OPENCODE_MEM_COMPRESSION_ENABLED", fileSettings.compression?.enabled ?? DEFAULT_SETTINGS.compression.enabled),
      minToolOutputLength: getEnvNumber("OPENCODE_MEM_COMPRESSION_MIN_LENGTH", fileSettings.compression?.minToolOutputLength ?? DEFAULT_SETTINGS.compression.minToolOutputLength),
      maxTokens: getEnvNumber("OPENCODE_MEM_COMPRESSION_MAX_TOKENS", fileSettings.compression?.maxTokens ?? DEFAULT_SETTINGS.compression.maxTokens),
    },
    context: {
      enabled: getEnvBool("OPENCODE_MEM_CONTEXT_ENABLED", fileSettings.context?.enabled ?? DEFAULT_SETTINGS.context.enabled),
      maxTokens: getEnvNumber("OPENCODE_MEM_CONTEXT_MAX_TOKENS", fileSettings.context?.maxTokens ?? DEFAULT_SETTINGS.context.maxTokens),
      observationCount: getEnvNumber("OPENCODE_MEM_CONTEXT_OBSERVATION_COUNT", fileSettings.context?.observationCount ?? DEFAULT_SETTINGS.context.observationCount),
    },
    viewer: {
      enabled: getEnvBool("OPENCODE_MEM_VIEWER_ENABLED", fileSettings.viewer?.enabled ?? DEFAULT_SETTINGS.viewer.enabled),
      port: getEnvNumber("OPENCODE_MEM_VIEWER_PORT", fileSettings.viewer?.port ?? DEFAULT_SETTINGS.viewer.port),
    },
    chroma: {
      enabled: getEnvBool("OPENCODE_MEM_CHROMA_ENABLED", fileSettings.chroma?.enabled ?? DEFAULT_SETTINGS.chroma.enabled),
      host: getEnvString("OPENCODE_MEM_CHROMA_HOST", fileSettings.chroma?.host ?? DEFAULT_SETTINGS.chroma.host),
    },
    privacy: {
      stripTags: getEnvBool("OPENCODE_MEM_PRIVACY_STRIP_TAGS", fileSettings.privacy?.stripTags ?? DEFAULT_SETTINGS.privacy.stripTags),
    },
    logLevel: (getEnvString("OPENCODE_MEM_LOG_LEVEL", fileSettings.logLevel ?? DEFAULT_SETTINGS.logLevel) as Settings["logLevel"]) ?? DEFAULT_SETTINGS.logLevel,
  };

  return settings;
}

export function saveSettings(settings: Settings): void {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export function ensureSettingsFile(): void {
  if (!existsSync(SETTINGS_FILE)) {
    saveSettings(DEFAULT_SETTINGS);
  }
}

export { DEFAULT_SETTINGS, SETTINGS_FILE };
