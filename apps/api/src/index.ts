import { Hono } from "hono";
import { cors } from "hono/cors";
import { PaginationQuerySchema, SearchQuerySchema } from "@argos/core";
import { MonitorUnavailableError, WorldMonitorClient } from "@argos/monitor";
import { monitorRoute } from "./routes/monitor.js";
import { statsRoute } from "./routes/stats.js";
import { articlesRoute } from "./routes/articles.js";
import { graphRoute } from "./routes/graph.js";
import { entityRoute } from "./routes/entity.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, service: "argos-api", version: "0.1.0" }),
);

function getClient(): WorldMonitorClient {
  return WorldMonitorClient.fromEnv();
}

app.route(
  "/api/monitor",
  monitorRoute(getClient, { PaginationQuerySchema, SearchQuerySchema, MonitorUnavailableError }),
);

// Phase 6 APIs
app.route("/api", statsRoute);
app.route("/api", articlesRoute);
app.route("/api", graphRoute);
app.route("/api", entityRoute);

const port = Number(process.env.API_PORT ?? 8787);

export default {
  port,
  fetch: app.fetch,
};

if (import.meta.main) {
  console.log(`◆ ARGOS API listening on http://localhost:${port}`);
}
