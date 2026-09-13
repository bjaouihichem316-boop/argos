import { Hono } from "hono";
import { getSession } from "@argos/graph";

export const entityRoute = new Hono();

entityRoute.get("/entity/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const session: any = await getSession();
    const entityRes = await session.run(
      `MATCH (e:Entity {id: $id})
       OPTIONAL MATCH (a:Article)-[:MENTIONS]->(e)
       RETURN e.id as id, e.name as name, e.nameAr as nameAr, e.kind as kind, e.aliases as aliases,
              collect(DISTINCT a.id) as articles`,
      { id },
    );
    const row = entityRes?.records?.[0];
    const entityData = row ? {
      id: row.get ? row.get("id") : row.id,
      name: row.get ? row.get("name") : row.name,
      nameAr: row.get ? row.get("nameAr") : row.nameAr,
      kind: row.get ? row.get("kind") : row.kind,
      aliases: row.get ? row.get("aliases") : row.aliases,
      articles: row.get ? row.get("articles") : row.articles,
    } : null;

    const coRes = await session.run(
      `MATCH (e:Entity {id: $id})-[:CO_OCCURS_WITH]->(other:Entity)
       RETURN other.id as id, other.name as name, other.kind as kind`,
      { id },
    );
    const coEntities = coRes?.records?.map((r: any) => ({
      id: r.get ? r.get("id") : r.id,
      name: r.get ? r.get("name") : r.name,
      kind: r.get ? r.get("kind") : r.kind,
    })) ?? [];

    await session.close();
    if (!entityData) return c.json({ ok: false, error: "not found" }, 404);
    return c.json({ ok: true, entity: { ...entityData, coEntities } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: msg }, 500);
  }
});
