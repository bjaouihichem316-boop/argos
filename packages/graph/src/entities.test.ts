/**
 * اختبارات تطبيع الكيانات (`bun test`) — pure functions، بلا Neo4j.
 */
import { describe, expect, test } from "bun:test";
import {
  entityIdFor,
  normalizeEntities,
  type ArticleAnalysis,
} from "./entities.js";

const SAMPLE: ArticleAnalysis = {
  summary: ["ملخص"],
  facts: [],
  analysis: [],
  confidence: "high",
  entities: {
    organizations: ["أبل", "شركة ناشئة"],
    people: ["تيم كوك"],
    places: ["كاليفورنيا"],
  },
};

describe("entityIdFor", () => {
  test("معرّف حتمي: kind + key بصيغة lowercase", () => {
    expect(entityIdFor("org", "  Apple ")).toBe("org:apple");
    expect(entityIdFor("org", "أبل")).toBe("org:أبل");
    expect(entityIdFor("org", "APPLE")).toBe(entityIdFor("org", "apple"));
  });
});

describe("normalizeEntities", () => {
  test("يوزّع الأنواع org/person/place بمعرّفات صحيحة", () => {
    const out = normalizeEntities(SAMPLE);
    expect(out).toHaveLength(4);
    const ids = out.map((e) => e.id).sort();
    expect(ids).toEqual(["org:أبل", "org:شركة ناشئة", "person:تيم كوك", "place:كاليفورنيا"]);
  });

  test("المفتاح lowercase والاسم الأصلي محفوظ في nameAr", () => {
    const out = normalizeEntities({
      summary: [],
      facts: [],
      analysis: [],
      confidence: "low",
      entities: { organizations: ["Apple"], people: [], places: [] },
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("apple");
    expect(out[0]?.nameAr).toBe("Apple");
    expect(out[0]?.aliases).toEqual([]);
  });

  test("يدمج المكررات ويجمع الصيغ البديلة في aliases", () => {
    const out = normalizeEntities({
      summary: [],
      facts: [],
      analysis: [],
      confidence: "medium",
      entities: { organizations: ["Apple", " apple ", "APPLE", "أبل"], people: [], places: [] },
    });
    // "Apple"/" apple "/"APPLE" نفس المفتاح؛ "أبل" مفتاح مختلف
    expect(out).toHaveLength(2);
    const latin = out.find((e) => e.id === "org:apple");
    expect(latin?.nameAr).toBe("Apple");
    expect(latin?.aliases).toEqual(["apple", "APPLE"]);
  });

  test("يهمل الأسماء الفارغة والبيضاء", () => {
    const out = normalizeEntities({
      summary: [],
      facts: [],
      analysis: [],
      confidence: "low",
      entities: { organizations: ["", "   ", "أبل"], people: [""], places: [] },
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("org:أبل");
  });

  test("يرجع قائمة فارغة عند غياب الكيانات", () => {
    const out = normalizeEntities({
      summary: ["s"],
      facts: [],
      analysis: [],
      confidence: "low",
      entities: { organizations: [], people: [], places: [] },
    });
    expect(out).toEqual([]);
  });

  test("يرمي عند تحليل غير صالح", () => {
    let threw = false;
    try {
      normalizeEntities("not-an-analysis" as unknown as ArticleAnalysis);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
