import { Hono } from "hono";
import { getStats } from "../../../worker/src/db/client.js";

export const statsRoute = new Hono();

statsRoute.get("/stats", async (c) => {
  try {
    const stats = await getStats();
    return c.json({ ok: true, ...stats });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: msg }, 500);
  }
});
