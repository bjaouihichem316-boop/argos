# ARGOS API (Phase 1)

Base URL: `http://localhost:8787`

## Health

### `GET /health`
```json
{ "ok": true, "service": "argos-api", "version": "0.1.0" }
```

## Monitor (worldmonitor MCP)

### `GET /api/monitor/tools`
List tools exposed by the worldmonitor MCP server.
```json
{ "tools": [{ "name": "get_latest", "description": "..." }] }
```

### `GET /api/monitor/latest?limit=10`
Latest intel signals (validated with `MonitorSignalSchema`).
```json
{
  "signals": [
    { "id": "sig_01", "title": "...", "summary": "...", "source": "...", "url": "...", "publishedAt": "...", "lang": "ar", "severity": "info", "tags": [] }
  ]
}
```
Query: `limit` (1–50, default 10).

### `GET /api/monitor/search?q=غزة&limit=10`
Full-text search over worldmonitor signals. `q` required (min 2 chars).

### Errors
```json
{ "error": { "code": "MONITOR_UNAVAILABLE", "message": "..." } }
```
- `MONITOR_UNAVAILABLE` (502): MCP server down / timeout.
- `BAD_REQUEST` (400): zod validation failed.

## Conventions
- JSON only. Arabic UTF-8 everywhere.
- Auth: none in Phase 1 (localhost). API keys from Phase 6.
- Versioning: `/api/*` stable; breaking changes → `/api/v2/*`.
