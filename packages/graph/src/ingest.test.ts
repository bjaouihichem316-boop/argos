/**
 * اختبارات إدخال المقال إلى الرسم (`bun test`).
 * تستعمل session مزيّفة تسجّل استعلامات Cypher — بلا خادم Neo4j.
 */
import { describe, expect, test } from "bun:test";
import type { Article } from "@argos/core";
import { ingestArticle } from "./ingest.js";
import type { ArticleAnalysis } from "./entities.js";
import type { SessionLike } from "./neo4j.js";

/** session مزيّفة تسجّل كل `run` وتعيد سجلات فارغة. */
function mockSession() {
  const calls: Array<{ cypher: string; params: Record<string, unknown> }> = [];
  const session: SessionLike = {
    run: async (cypher, params) => {
      calls.push({ cypher, params: params ?? {} });
      return { records: [] };
    },
    close: async () => undefined,
  };
  return { session, calls };
}

const ARTICLE: Article = {
  id: "art-apple-1",
  title: "أبل تستحوذ على شركة ناشئة في الذكاء الاصطناعي",
  body: "أعلنت أبل استحواذها على شركة ناشئة متخصصة في الذكاء الاصطناعي في كاليفورنيا.",
  source: "وكالة الأنباء",
  url: "https://example.com/articles/apple-1",
  lang: "ar",
  tags: [],
};

const ANALYSIS: ArticleAnalysis = {
  summary: ["أبل تستحوذ على شركة ناشئة."],
  facts: [],
  analysis: [],
  confidence: "high",
  entities: {
    organizations: ["أبل", "شركة ناشئة"],
    people: ["تيم كوك"],
    places: [],
  },
};

describe("ingestArticle", () => {
  test("يُدخل المقال و3 كيانات: 3 MENTIONS + 3 CO_OCCURS_WITH", async () => {
    const { session, calls } = mockSession();
    const res = await ingestArticle(ARTICLE, ANALYSIS, session);

    expect(res.articleId).toBe("art-apple-1");
    expect(res.entityCount).toBe(3);
    expect(res.relationshipCount).toBe(6); // 3 ذكر + C(3,2)=3 تزامن

    // 3 استعلامات: المقال ثم الكيانات ثم التزامن
    expect(calls).toHaveLength(3);
    expect((calls[1]?.params["entities"] as unknown[])).toHaveLength(3);
    expect((calls[2]?.params["pairs"] as unknown[])).toHaveLength(3);
    expect(calls[2]?.params["articleId"]).toBe("art-apple-1");
  });

  test("يستعمل MERGE و UNWIND (لا CREATE) — idempotent", async () => {
    const { session, calls } = mockSession();
    await ingestArticle(ARTICLE, ANALYSIS, session);

    const all = calls.map((c) => c.cypher).join("\n");
    expect(all.includes("MERGE")).toBe(true);
    expect(all.includes("UNWIND")).toBe(true);
    expect(all.includes("CO_OCCURS_WITH")).toBe(true);
    expect(all.includes("MENTIONS")).toBe(true);
    expect(all.includes("CREATE")).toBe(false);
  });

  test("يتخطى استعلام التزامن عند كيان واحد (لا أزواج)", async () => {
    const { session, calls } = mockSession();
    const res = await ingestArticle(
      ARTICLE,
      {
        summary: [],
        facts: [],
        analysis: [],
        confidence: "low",
        entities: { organizations: ["أبل"], people: [], places: [] },
      },
      session,
    );
    expect(res.entityCount).toBe(1);
    expect(res.relationshipCount).toBe(1); // ذكر واحد فقط
    expect(calls).toHaveLength(2);
  });

  test("يرمي عند مقال غير صالح", async () => {
    const { session } = mockSession();
    let threw = false;
    try {
      await ingestArticle({ ...ARTICLE, id: "" }, ANALYSIS, session);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
