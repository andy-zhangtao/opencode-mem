import type {
  ICompressionEngine,
  RawToolEvent,
  ParsedObservation,
  ParsedSummary,
  CompressionContext,
} from "./types";

export class MockCompressionEngine implements ICompressionEngine {
  async compressObservation(
    events: RawToolEvent[],
    context: CompressionContext
  ): Promise<ParsedObservation[]> {
    return events.map((event) => ({
      type: "tool_use",
      title: `Used ${event.toolName}`,
      subtitle: event.cwd,
      facts: [
        `Executed ${event.toolName} at ${new Date(event.timestamp).toISOString()}`,
      ],
      narrative: `Tool ${event.toolName} was executed with input ${JSON.stringify(event.toolInput)}`,
      concepts: [event.toolName],
      files_read: [],
      files_modified: [],
    }));
  }

  async generateSummary(
    sessionId: string,
    context: CompressionContext
  ): Promise<ParsedSummary> {
    return {
      request: context.userPrompt,
      investigated: "Mock investigation",
      learned: "Mock learnings",
      completed: "Mock completion status",
      next_steps: "Mock next steps",
      notes: "Mock notes",
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
