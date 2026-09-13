# `@argos/monitor` — worldmonitor MCP client

Phase 1 entry point. Minimal MCP Streamable-HTTP client (JSON-RPC 2.0 POST).

## Usage

```ts
import { WorldMonitorClient } from "@argos/monitor";

const client = WorldMonitorClient.fromEnv(); // WORLDMONITOR_MCP_URL
const tools = await client.listTools();
const latest = await client.getLatestSignals({ limit: 5 });
const hits = await client.searchSignals("غزة", { limit: 10 });
```

## Env

| Var | Default | Description |
|---|---|---|
| `WORLDMONITOR_MCP_URL` | `http://localhost:3100/mcp` | MCP endpoint |
| `WORLDMONITOR_API_KEY` | — | Bearer key (optional) |
| `WORLDMONITOR_TIMEOUT_MS` | `15000` | Request timeout |

## Notes

- Pure `fetch` — works in Bun, Node 18+, and Next.js.
- High-level helpers auto-discover tool names (`get_latest*` / `search*`) then validate with `MonitorSignalSchema` from `@argos/core`. Invalid items are dropped, never thrown.
- Errors throw `MonitorUnavailableError` (`code: "MONITOR_UNAVAILABLE"`) → API maps to HTTP 502.
