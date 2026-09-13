import { Hono } from "hono";
import type { PaginationQuerySchema, SearchQuerySchema } from "@argos/core";
import type { MonitorUnavailableError, WorldMonitorClient } from "@argos/monitor";

interface Deps {
  PaginationQuerySchema: typeof PaginationQuerySchema;
  SearchQuerySchema: typeof SearchQuerySchema;
  MonitorUnavailableError: typeof MonitorUnavailableError;
}

/** Mounted at /api/monitor. Phase 1: worldmonitor passthrough with zod validation. */
export function monitorRoute(getClient: () => WorldMonitorClient, deps: Deps): Hono {
  const r = new Hono();

  r.get("/tools", async (c) => {
    try {
      const tools = await getClient().listTools();
      return c.json({ tools });
    } catch (err) {
      return monitorError(c, err, deps);
    }
  });

  r.get("/latest", async (c) => {
    const parsed = deps.PaginationQuerySchema.safeParse({
      limit: c.req.query("limit"),
    });
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST", message: "invalid `limit` (1–50)" } }, 400);
    }
    try {
      const signals = await getClient().getLatestSignals({ limit: parsed.data.limit });
      return c.json({ signals });
    } catch (err) {
      return monitorError(c, err, deps);
    }
  });

  r.get("/search", async (c) => {
    const parsed = deps.SearchQuerySchema.safeParse({
      q: c.req.query("q"),
      limit: c.req.query("limit"),
    });
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST", message: "need `q` (≥2 chars) + optional `limit`" } }, 400);
    }
    try {
      const signals = await getClient().searchSignals(parsed.data.q, { limit: parsed.data.limit });
      return c.json({ signals });
    } catch (err) {
      return monitorError(c, err, deps);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function monitorError(c: any, err: unknown, d: Deps) {
    if (err instanceof d.MonitorUnavailableError) {
      return c.json(
        { error: { code: "MONITOR_UNAVAILABLE", message: err.message } },
        502,
      );
    }
    const message = err instanceof Error ? err.message : "unknown error";
    return c.json({ error: { code: "INTERNAL", message } }, 500);
  }

  return r;
}
