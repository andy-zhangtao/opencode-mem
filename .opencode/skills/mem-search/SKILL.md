---
name: mem-search
description: Search opencode-mem's persistent cross-session memory database. Use when user asks "did we already solve this?", "how did we do X last time?", or needs work from previous sessions.
---

# Memory Search

Search past work across all sessions. Simple workflow: search -> filter -> fetch.

## When to Use

Use when users ask about PREVIOUS sessions (not current conversation):

- "Did we already fix this?"
- "How did we solve X last time?"
- "What happened last week?"

## 3-Layer Workflow (ALWAYS Follow)

**NEVER fetch full details without filtering first. 10x token savings.**

### Step 1: Search - Get Index with IDs

Use the `search` MCP tool:

```
search(query="authentication", limit=20, project="my-project")
```

**Returns:** Table with IDs, timestamps, types, titles (~50-100 tokens/result)

```
| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #11131 | 3:48 PM | 🔵 | Added JWT authentication | ~75 |
| #10942 | 2:15 PM | 🔵 | Fixed auth token expiration | ~50 |
```

**Parameters:**

- `query` (string, required) - Search term
- `limit` (number) - Max results, default 20
- `project` (string) - Project name filter
- `sessionId` (string) - Filter by session ID
- `dateFrom` (string) - ISO date string
- `dateTo` (string) - ISO date string
- `offset` (number) - Skip N results

### Step 2: Timeline - Get Context Around Interesting Results

Use the `timeline` MCP tool:

```
timeline(anchor=11131, depthBefore=3, depthAfter=3, project="my-project")
```

Or find anchor automatically from query:

```
timeline(query="authentication", depthBefore=3, depthAfter=3, project="my-project")
```

**Returns:** `depthBefore + 1 + depthAfter` items in chronological order with observations around the anchor.

**Parameters:**

- `anchor` (number) - Observation ID to center around
- `query` (string) - Find anchor automatically if anchor not provided
- `sessionId` (string) - Get timeline for specific session
- `depthBefore` (number) - Items before anchor, default 5
- `depthAfter` (number) - Items after anchor, default 5
- `project` (string) - Project name filter

### Step 3: Fetch - Get Full Details ONLY for Filtered IDs

Review titles from Step 1 and context from Step 2. Pick relevant IDs. Discard the rest.

Use the `get_observations` MCP tool:

```
get_observations(ids=[11131, 10942])
```

**ALWAYS use `get_observations` for 2+ observations - single request vs N requests.**

**Parameters:**

- `ids` (array of numbers, required) - Observation/Summary IDs to fetch
- `type` (string) - "observation" (default) or "summary"

**Returns:** Complete observation objects with title, subtitle, narrative, facts, concepts, files (~500-1000 tokens each)

## Saving Memories

Use the `save_memory` MCP tool to store manual observations:

```
save_memory(text="Important discovery about the auth system", title="Auth Architecture", project="my-project")
```

**Parameters:**

- `text` (string, required) - Content to remember
- `title` (string) - Short title, auto-generated if omitted
- `project` (string) - Project name, defaults to "opencode-mem"

## Examples

**Find recent authentication work:**

```
search(query="auth", limit=20, project="my-project")
```

**Understand context around a discovery:**

```
timeline(anchor=11131, depthBefore=5, depthAfter=5, project="my-project")
```

**Batch fetch details:**

```
get_observations(ids=[11131, 10942, 10855])
```

## Why This Workflow?

- **Search index:** ~50-100 tokens per result
- **Full observation:** ~500-1000 tokens each
- **Batch fetch:** 1 request vs N individual requests
- **10x token savings** by filtering before fetching
