# opencode-mem

Persistent memory plugin for [OpenCode](https://github.com/anomalyco/opencode). Captures tool usage, compresses observations with AI, and injects relevant historical context into new sessions.

## Features

- **Persistent Memory** - Context survives across sessions
- **3-Layer Search** - Token-efficient search workflow (search → timeline → fetch)
- **AI Compression** - Uses OpenCode's configured LLM provider
- **MCP Tools** - 5 search tools for querying memory
- **HTTP API** - REST endpoints for Viewer UI
- **Privacy Control** - `<private>` tags exclude sensitive content

## Installation

```bash
# Add to your OpenCode config
# ~/.config/opencode/opencode.json
{
  "plugins": [
    "/path/to/opencode-mem"
  ]
}
```

## MCP Tools

### `search`
Search memory index with full-text queries.

```
search(query="authentication", limit=20, project="my-project")
```

### `timeline`
Get chronological context around an observation.

```
timeline(anchor=11131, depthBefore=3, depthAfter=3)
```

### `get_observations`
Fetch full observation details by IDs.

```
get_observations(ids=[11131, 10942])
```

### `save_memory`
Save a manual memory for future sessions.

```
save_memory(text="Important note", title="My Note", project="my-project")
```

### `__IMPORTANT`
View the 3-layer workflow documentation.

## HTTP API

The HTTP server runs on port 37778 by default.

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/stats` | Database statistics |
| `GET /api/projects` | List all projects |
| `GET /api/sessions` | List sessions |
| `GET /api/search?q=...` | Search memory |
| `GET /api/timeline/:sessionId` | Get session timeline |
| `GET /api/observations?ids=...` | Get observations by IDs |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build
```

## License

AGPL-3.0 - See [LICENSE](LICENSE) and [ATTRIBUTION.md](ATTRIBUTION.md) for details.

Ported from [claude-mem](https://github.com/thedotmack/claude-mem) by Alex Newman (@thedotmack).
