/**
 * اختبارات استعلامات Cypher (`bun test`).
 * تستعمل session مزيّفة بسجلات عادية — بلا خادم Neo4j.
 */
import { describe, expect, test } from "bun:test";
import {
  findArticlesMentioning,
  findCoOccurringEntities,
  findEntityNetwork,
  findPathBetween,
  GraphError,
} from "./query.js";
import type { SessionLike } from "./neo4j.js";

/** session مزيّفة ترد بسجلات ثابتة وتسجّل آخر استعلام ووسائطه. */
function mockSession(records: unknown[]) {
  const seen: { cypher: string; params: Record<string, unknown> } = { cypher: "", params: {} };
  const session: SessionLike = {
    run: async (cypher, params) => {
      seen.cypher = cypher;
      seen.params = params ?? {};
      return { records };
    },
    close: async () => undefined,
  };
  return { session, seen };
}

describe("findPathBetween", () => {
  test("يبني shortestPath ويعيد المسار بطوله", async () => {
    const { session, seen } = mockSession([
      {
        nodes: [
          { id: "org:أبل", kind: "org", name: "أبل", nameAr: "أبل", labels: ["Entity"] },
          { id: "org:شركة ناشئة", kind: "org", name: "شركة ناشئة", nameAr: "شركة ناشئة", labels: ["Entity"] },
        ],
      },
    ]);
    const paths = await findPathBetween("أبل", "شركة ناشئة", 3, session);

    expect(seen.cypher.includes("shortestPath")).toBe(true);
    expect(seen.cypher.includes("[*..3]")).toBe(true);
    expect(seen.params).toEqual({ from: "أبل", to: "شركة ناشئة" });
    expect(paths).toHaveLength(1);
    expect(paths[0]?.length).toBe(1);
    expect(paths[0]?.nodes.map((n) => n.id)).toEqual(["org:أبل", "org:شركة ناشئة"]);
  });

  test("يرجع قائمة فارغة عند غياب المسارات", async () => {
    const { session } = mockSession([]);
    expect(await findPathBetween("أبل", "غير موجود", 3, session)).toEqual([]);
  });

  test("يرمي GraphError على مدخلات غير صالحة", async () => {
    const { session } = mockSession([]);
    for (const fn of [
      () => findPathBetween("  ", "أبل", 3, session),
      () => findPathBetween("أبل", "شركة ناشئة", 0, session),
      () => findPathBetween("أبل", "شركة ناشئة", 99, session),
    ]) {
      let threw = false;
      try {
        await fn();
      } catch (err) {
        threw = err instanceof GraphError;
      }
      expect(threw).toBe(true);
    }
  });
});

describe("findArticlesMentioning", () => {
  test("يعيد Article[] من خريطة العقدة", async () => {
    const { session, seen } = mockSession([
      {
        article: {
          id: "art-1",
          title: "خبر أبل",
          body: "متن الخبر",
          source: "وكالة",
          url: "https://example.com/1",
          lang: "ar",
          tags: [],
        },
      },
    ]);
    const articles = await findArticlesMentioning("أبل", session);
    expect(seen.cypher.includes("MENTIONS")).toBe(true);
    expect(articles).toHaveLength(1);
    expect(articles[0]?.id).toBe("art-1");
    expect(articles[0]?.title).toBe("خبر أبل");
  });
});

describe("findCoOccurringEntities", () => {
  test("يعيد الكيانات مع counts (ويحوّل Integer)", async () => {
    const { session, seen } = mockSession([
      {
        entity: { id: "person:تيم كوك", kind: "person", name: "تيم كوك", nameAr: "تيم كوك", labels: ["Entity"] },
        articleCount: { toNumber: () => 3 },
      },
    ]);
    const out = await findCoOccurringEntities("أبل", 2, session);
    expect(seen.cypher.includes("articleCount >= $minCount")).toBe(true);
    expect(seen.params["minCount"]).toBe(2);
    expect(out).toHaveLength(1);
    expect(out[0]?.entity.id).toBe("person:تيم كوك");
    expect(out[0]?.count).toBe(3);
  });
});

describe("findEntityNetwork", () => {
  test("يدمج العقد المكررة والحواف", async () => {
    const { session, seen } = mockSession([
      {
        nodes: [
          { id: "org:أبل", kind: "org", name: "أبل", nameAr: "أبل", labels: ["Entity"] },
          { id: "person:تيم كوك", kind: "person", name: "تيم كوك", nameAr: "تيم كوك", labels: ["Entity"] },
        ],
        edges: [{ type: "MENTIONS", fromId: "art-1", toId: "org:أبل" }],
      },
      {
        nodes: [{ id: "org:أبل", kind: "org", name: "أبل", nameAr: "أبل", labels: ["Entity"] }],
        edges: [
          { type: "MENTIONS", fromId: "art-1", toId: "org:أبل" },
          { type: "CO_OCCURS_WITH", fromId: "org:أبل", toId: "person:تيم كوك" },
        ],
      },
    ]);
    const net = await findEntityNetwork("أبل", 2, session);
    expect(seen.cypher.includes("[*..2]")).toBe(true);
    expect(net.nodes).toHaveLength(2); // دمج المكرر
    expect(net.edges).toHaveLength(2); // دمج الحافة المكررة
  });
});
