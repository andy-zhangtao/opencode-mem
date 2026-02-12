import { mkdirSync, existsSync, appendFileSync } from "fs";
import { dirname } from "path";

const LOG_DIR = "/tmp/claude-mem";
const LOG_ENV_VAR = "OPENCODE_MEM_LOG";

let logEnabled: boolean | null = null;

function isLogEnabled(): boolean {
  if (logEnabled === null) {
    logEnabled = process.env[LOG_ENV_VAR] === "1" || process.env[LOG_ENV_VAR] === "true";
  }
  return logEnabled;
}

function writeToFile(filename: string, ...args: unknown[]): void {
  if (!isLogEnabled()) return;
  
  try {
    const logPath = `${LOG_DIR}/${filename}`;
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
  } catch {}
}

export const logger = {
  error: (...args: unknown[]): void => {
    console.error(...args);
    writeToFile("error.log", ...args);
  },

  warn: (...args: unknown[]): void => {
    writeToFile("warn.log", ...args);
  },

  info: (...args: unknown[]): void => {
    writeToFile("info.log", ...args);
  },

  debug: (...args: unknown[]): void => {
    writeToFile("debug.log", ...args);
  },
};
