/**
 * Ported from claude-mem (https://github.com/thedotmack/claude-mem)
 * Copyright (C) 2025 Alex Newman (@thedotmack)
 * Licensed under AGPL-3.0
 *
 * Adapted for opencode-mem: __IMPORTANT tool that stores high-priority context
 * and returns the 3-layer workflow documentation.
 */

export function importantTool(): string {
  return `# Memory Search Workflow

**3-Layer Pattern (ALWAYS follow this):**

1. **Search** - Get index of results with IDs
   \`search(query="...", limit=20, project="...")\`
   Returns: Table with IDs, titles, dates (~50-100 tokens/result)

2. **Timeline** - Get context around interesting results
   \`timeline(anchor=<ID>, depthBefore=3, depthAfter=3)\`
   Returns: Chronological context showing what was happening

3. **Fetch** - Get full details ONLY for relevant IDs
   \`get_observations(ids=[...])\`  # ALWAYS batch for 2+ items
   Returns: Complete details (~500-1000 tokens/result)

**Why:** 10x token savings. Never fetch full details without filtering first.

**Tool Reference:**
- \`search\`: FTS5 search across observations, summaries, and prompts
- \`timeline\`: Chronological session context around an anchor observation
- \`get_observations\`: Batch fetch full observation/summary content by IDs
- \`save_memory\`: Manually persist a memory for future sessions`;
}
