import { Hono } from "hono";
import { getSession } from "@argos/graph";

export const graphRoute = new Hono();

graphRoute.get("/graph/network", async (c) => {
  try {
    const session: any = await getSession();
    const result = await session.run(
      `MATCH (n) RETURN labels(n) as label, n.id as id, n.name as name, n.kind as kind LIMIT 100`
    );
    const records = result?.records ?? [];
    const nodes = records.map((r: any) => ({
      id: r.get ? r.get("id") : r.id,
      label: r.get ? r.get("name") : r.name,
      group: r.get ? r.get("kind") : (Array.isArray(r.get ? r.get("label") : r.label) ? (r.get ? r.get("label")[0] : r.label[0]) : (r.get ? r.get("label") : r.label) || "unknown"),
    }));
    await session.close();
    return c.json({ ok: true, nodes, links: [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: msg }, 500);
  }
});
