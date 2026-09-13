import { Hono } from "hono";
import { getPendingIngest, getPendingAnalysis, getArticleById } from "../../../worker/src/db/client.js";

export const articlesRoute = new Hono();

articlesRoute.get("/articles", async (c) => {
  const sourceParam = c.req.query("source") ?? "";
  const searchParam = (c.req.query("search") ?? "").toLowerCase();
  const limitParam = Math.min(Math.max(Number(c.req.query("limit") ?? 20), 1), 50);

  try {
    const rows = await getPendingIngest(100);
    let articles = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      source: r.source,
      url: r.url,
      publishedAt: r.published_at,
      lang: r.lang,
      analyzed: r.analyzed,
      ingested: r.ingested,
      tags: r.tags,
    }));

    if (sourceParam) {
      articles = articles.filter((a: any) => a.source === sourceParam);
    }
    if (searchParam) {
      articles = articles.filter(
        (a: any) => a.title.toLowerCase().includes(searchParam) || (a.tags ?? []).join(" ").toLowerCase().includes(searchParam),
      );
    }

    return c.json({ ok: true, count: articles.length, articles: articles.slice(0, limitParam) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: msg }, 500);
  }
});

articlesRoute.get("/articles/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const row = await getArticleById(id);
    if (!row) return c.json({ ok: false, error: "not found" }, 404);
    return c.json({ ok: true, article: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: msg }, 500);
  }
});
