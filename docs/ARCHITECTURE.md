# ARGOS Architecture

> Local-first • Arabic-first • crypto-native OSINT news-intelligence platform.
> Bun workspaces + Turborepo monorepo. TypeScript strict everywhere.

## 1. Big picture

```
                    ┌─────────────┐
                    │ worldmonitor│  (MCP — external intel feed)
                    │  MCP server │
                    └──────┬──────┘
                           │  packages/monitor
                    ┌──────▼──────┐      ┌──────────┐
                    │  apps/api   │◄────►│ apps/web │  Next.js 15 + RainbowKit
                    │ Hono on Bun │      └──────────┘
                    └──────┬──────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        packages/    packages/    packages/
        aggregator    graph        video
        (RSS)         (Neo4j)      (FFmpeg)
              │            │            │
              └────────────┼────────────┘
                           ▼
                    apps/worker (BullMQ)
                    Redis queues
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        packages/    packages/    packages/
        ollama       tor          payments
        (local LLM)  (Tor/I2P)    (Paylix/Base)
```

Data flow (Phase 1 → 6): **Ingest → Normalize → Analyze → Graph → Publish → Monetize.**

## 2. Apps

### `apps/web` — Next.js 15 + Tailwind + RainbowKit
- Public news feed (Arabic RTL-first), entity/event pages, video player.
- RainbowKit + wagmi for Base wallet connect (crypto-native auth/payments).
- Talks to `apps/api` only. No direct DB access.
- `app/` router, `components/`, `lib/api-client.ts`.

### `apps/api` — Hono on Bun
- Lightweight HTTP API (Bun runtime, Hono router).
- Routes: `/health`, `/api/monitor/*` (Phase 1), later `/api/articles`, `/api/graph`, `/api/videos`, `/api/payments`.
- Validates I/O with `@argos/core` zod schemas. No business logic — delegates to packages.
- Port `8787` (`API_PORT`).

### `apps/worker` — BullMQ jobs
- Background pipelines: `monitor-poll`, `rss-fetch`, `analyze`, `graph-upsert`, `video-render`.
- Redis-backed (`REDIS_URL`). Each queue in `src/queues/`, each job in `src/jobs/`.
- Phase 1: `monitor-poll` only (poll worldmonitor → Postgres).

### `apps/cli` — Commander.js
- Operator tool: `argos monitor latest`, `argos rss fetch`, `argos graph query`, `argos video render`.
- Uses the same packages as api/worker. First-class citizen for local-first ops.

## 3. Packages

### `packages/core` — shared types + zod schemas
- Single source of truth: `Article`, `Event`, `Entity`, `MonitorSignal`, `VideoJob`, `PaymentIntent`.
- Zod schemas for API validation + DB row parsing. No deps except `zod`.
- Every app/package imports types from here. Never duplicate types.

### `packages/monitor` — worldmonitor MCP client ⭐ Phase 1
- MCP (Model Context Protocol) client for the `worldmonitor` intel server.
- `WorldMonitorClient`: `listTools()`, `callTool()`, `getLatestSignals()`, `searchSignals()`.
- Transport: Streamable HTTP (`WORLDMONITOR_MCP_URL`), timeout + zod validation.
- Pure + testable: inject `fetch` for tests. No Bun-only APIs (works in Next.js too).
- See `packages/monitor/README.md`.

### `packages/aggregator` — RSS aggregator (Phase 2)
- Fetches RSS/Atom feeds, normalizes to `Article`, dedupes by URL hash + simhash.
- Planned: `fetchFeed()`, `parseFeed()`, `dedupe()`. Backed by Postgres.

### `packages/tor` — Tor + I2P fetcher (Phase 4)
- SOCKS5 (`TOR_SOCKS_PROXY`) + I2P HTTP (`I2P_HTTP_PROXY`) fetch with rotation + retry.
- Onion allowlist, content sanitization. Never fetch clearnet over Tor (waste).

### `packages/graph` — Neo4j + GraphRAG (Phase 3)
- Neo4j driver wrapper (`NEO4J_URI`), Cypher builders, entity/event upserts.
- GraphRAG: vector index (Ollama embeddings) + traversal → grounded Arabic summaries.

### `packages/video` — Playwright + FFmpeg + TTS (Phase 5)
- Renders article → screenshot (Playwright) → voiceover (local TTS) → mux (FFmpeg).
- Deterministic templates, Arabic subtitle burn-in. Outputs to `outputs/`.

### `packages/payments` — paylix SDK wrapper (Phase 6)
- Wraps Paylix SDK: `createIntent()`, `verifyWebhook()` (`PAYLIX_WEBHOOK_SECRET`).
- Settles on Base L2 (`BASE_RPC_URL`). No custodial logic in ARGOS.

### `packages/ollama` — Ollama client + Modelfiles (Phase 2)
- Typed client for `OLLAMA_HOST`: `chat()`, `embed()`, streaming.
- Default model `falcon-h1-ar` (see `Modelfiles/falcon-h1-ar.Modelfile`).
- Arabic system prompts live here, versioned with the Modelfile.

## 4. Infra

- `infra/docker/docker-compose.yml`: Neo4j (7474/7687) + Postgres (5432) + Redis (6379) + Ollama (11434, optional profile).
- `infra/scripts/setup.sh`: checks Bun/Docker, copies `.env`, pulls Ollama model.
- All stateful data is local. Nothing is committed.

## 5. Conventions

- **TypeScript strict** (`noUncheckedIndexedAccess`), ESM, `.js` import suffixes where needed.
- **Bun workspaces**: package names `@argos/*`. Cross-import via workspace names, not relative paths across packages.
- **Turborepo**: `build`/`dev`/`lint`/`typecheck` pipelines. `dev` is persistent, no cache.
- **Env**: every secret in `.env` (see `.env.example`). Code reads via `process.env` with zod validation at boot.
- **Arabic-first**: user-facing strings in Arabic by default; code/docs bilingual AR/EN.
