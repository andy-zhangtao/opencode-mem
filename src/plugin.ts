import type { Plugin } from "@opencode-ai/plugin";
import { Database } from "./db/database";
import { toolExecuteBefore, toolExecuteAfter } from "./hooks/tool-capture";
import { chatMessage } from "./hooks/chat-capture";
import { sessionCreated } from "./hooks/event-handler";
import { systemTransform } from "./hooks/context-injection";
import { OpencodeProviderEngine } from "./compression/opencode-engine";
import { startCompressionQueue } from "./compression/queue-processor";
import { startHTTPServer } from "./mcp/http";

const plugin: Plugin = async (input) => {
  const db = Database.create();

  // Use the v1 client from plugin input - it has proper internal fetch configured
  const engine = new OpencodeProviderEngine(input.client, input.directory);

  // Start background compression queue processor (fire-and-forget)
  startCompressionQueue(db, engine);

  startHTTPServer(db);

  return {
    "tool.execute.before": async (hookInput, output) => {
      await toolExecuteBefore(hookInput, output);
    },
    "tool.execute.after": async (hookInput, output) => {
      await toolExecuteAfter(hookInput, output, db);
    },
    "chat.message": async (hookInput, output) => {
      await chatMessage(hookInput, output, db);
    },
    "experimental.chat.system.transform": async (hookInput, output) => {
      await systemTransform(hookInput, output, db);
    },
    event: async ({ event }) => {
      if (event.type === "session.created") {
        await sessionCreated(event as any, db);
      }
    },
  };
};

export default plugin;
