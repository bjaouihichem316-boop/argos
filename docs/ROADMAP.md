# ARGOS Roadmap

## Phase 1 — Foundation + worldmonitor (✅ current)
- [x] Monorepo scaffold (Bun + Turbo + strict TS)
- [x] `packages/core` types + zod schemas
- [x] `packages/monitor` MCP client (`listTools`, `callTool`, `getLatestSignals`, `searchSignals`)
- [x] `apps/api` `/health` + `/api/monitor/*`
- [x] `apps/cli` `monitor latest/search/tools`
- [x] Docker Compose (Neo4j + Postgres + Redis)
- [ ] `bun install` + `bun run typecheck` green on dev machine

## Phase 2 — RSS + Arabic analysis
- [ ] `packages/aggregator`: RSS fetch/parse/dedupe → Postgres
- [ ] `packages/ollama`: chat/embed client + Arabic prompts
- [ ] Worker jobs: `rss-fetch`, `analyze` (summarize + entities + sentiment, Arabic)
- [ ] API: `GET /api/articles`, `GET /api/articles/:id`
- [ ] Web: Arabic RTL feed + article page

## Phase 3 — Knowledge Graph (GraphRAG)
- [ ] `packages/graph`: Neo4j driver, entity/event upsert, vector index
- [ ] Worker job: `graph-upsert`
- [ ] API: `GET /api/graph/entities`, `GET /api/graph/events/:id`
- [ ] Web: entity/event pages + relation viz

## Phase 4 — Tor / I2P
- [ ] `packages/tor`: SOCKS5 + I2P fetch, allowlist, sanitizer
- [ ] Worker job: `dark-fetch` (opt-in, rate-limited)
- [ ] Docs: OPSEC guide (Arabic + English)

## Phase 5 — Video generation
- [ ] `packages/video`: Playwright screenshots + TTS + FFmpeg mux + AR subtitles
- [ ] Worker job: `video-render`, `outputs/` pipeline
- [ ] API: `POST /api/videos`, `GET /api/videos/:id`
- [ ] Web: video player + auto-publish queue

## Phase 6 — Crypto monetization
- [ ] `packages/payments`: Paylix wrapper, Base L2 settle, webhooks
- [ ] API: `POST /api/payments/intent`, `POST /api/payments/webhook`
- [ ] Web: RainbowKit paywall + subscriptions
- [ ] Audit: keys never in repo, `PAYLIX_ENV=sandbox` default
