/**
 * @argos/worker — اختبارات عميل قاعدة البيانات (`bun test`)
 *
 * يستخدم `MockSqlDriver` مزيّفاً بدلاً من DB حقيقي.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  getDb,
  setMockSql,
  upsertArticle,
  getPendingAnalysis,
  getPendingIngest,
  getStats,
  initSchema,
  markAnalyzed,
  markAnalysisFailed,
  markIngested,
  type ArticleRow,
} from "./client.js";
import { SQL } from "bun";
import type { Article } from "@argos/core";

/** سائق SQL مزيّف للاختبارات. */
class MockSqlDriver {
  queries: Array<{ sql: string; values?: any[] }> = [];
  private responses: any[];

  constructor(responses: any[]) {
    this.responses = [...responses];
  }

  array(values: any[], type?: string | number): any {
    return values;
  }

  async unsafe<T>(sqlStr: string, values?: any[]): Promise<T> {
    this.queries.push({ sql: sqlStr, values });
    const resp = this.responses.shift();
    return (resp !== undefined ? resp : []) as T;
  }
}

describe("DB client — mock SQL driver", () => {
  beforeEach(() => {
    // إعادة تعيين singleton عبر mock فارغ بعد كل اختبار
    setMockSql(new MockSqlDriver([]) as unknown as SQL);
  });

  describe("upsertArticle", () => {
    test("يُدرج مقالاً جديداً عند غياب `url` ويُرجع isNew=true", async () => {
      const mockDriver = new MockSqlDriver([[{ id: "new-id" }]]);
      setMockSql(mockDriver as unknown as SQL);

      const article: Article = {
        id: "a1",
        title: "عنوان تجريبي",
        body: "نص المقال",
        source: "المصدر",
        url: "http://test/test",
        lang: "ar",
        tags: ["سياسة"],
        publishedAt: "2024-06-01T10:00:00Z",
      };

      const result = await upsertArticle(article);
      expect(result.isNew).toBe(true);
      expect(result.id).toBe("new-id");
      expect(mockDriver.queries).toHaveLength(1);
      expect(mockDriver.queries[0]?.sql).toContain("INSERT INTO articles");
    });

    test("يتجاهل الإدراج عند وجود `url` ويُرجع isNew=false", async () => {
      const mockDriver = new MockSqlDriver([[]]);
      setMockSql(mockDriver as unknown as SQL);

      const article: Article = {
        id: "a2",
        title: "موجود",
        body: "نص",
        source: "المصدر",
        url: "http://test/old",
        lang: "ar",
        tags: [],
      };

      const result = await upsertArticle(article);
      expect(result.isNew).toBe(false);
      expect(result.id).toBe("a2");
      expect(mockDriver.queries).toHaveLength(1);
    });
  });

  describe("getPendingAnalysis", () => {
    test("يُرجع فقط المقالات غير المُحلّلة مع retry_count < 3", async () => {
      const mockRow: ArticleRow = {
        id: "p1",
        title: "غير مُحلّل",
        body: "نص",
        source: "S",
        url: "http://test/p",
        published_at: "2024-05-01T08:00:00Z",
        lang: "ar",
        author: null,
        tags: [],
        analyzed: false,
        ingested: false,
        analysis: null,
        error: null,
        retry_count: 1,
        created_at: "2024-05-01T08:00:00Z",
        updated_at: "2024-05-01T08:00:00Z",
      };
      const mockDriver = new MockSqlDriver([[mockRow]]);
      setMockSql(mockDriver as unknown as SQL);

      const rows = await getPendingAnalysis(5);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe("p1");
      expect(mockDriver.queries[0]?.sql).toContain("analyzed = FALSE");
      expect(mockDriver.queries[0]?.sql).toContain("retry_count < 3");
    });
  });

  describe("getPendingIngest", () => {
    test("يُرجع المقالات المُحلّلة وغير المُستوعبة", async () => {
      const mockRow: ArticleRow = {
        id: "i1",
        title: "مُستوعب لاحقاً",
        body: "نص",
        source: "S",
        url: "http://test/i",
        published_at: "2024-04-01T07:00:00Z",
        lang: "ar",
        author: null,
        tags: ["اقتصاد"],
        analyzed: true,
        ingested: false,
        analysis: { summary: ["ملخص"], facts: [], analysis: [], confidence: "medium", entities: { organizations: [], people: [], places: [] } },
        error: null,
        retry_count: 0,
        created_at: "2024-04-01T07:00:00Z",
        updated_at: "2024-04-01T07:00:00Z",
      };
      const mockDriver = new MockSqlDriver([[mockRow]]);
      setMockSql(mockDriver as unknown as SQL);

      const rows = await getPendingIngest(10);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.analyzed).toBe(true);
      expect(rows[0]?.ingested).toBe(false);
    });
  });

  describe("getStats", () => {
    test("يُرجع الإحصائيات الصحيحة من الجدول", async () => {
      const mockDriver = new MockSqlDriver([
        [
          {
            total: 42,
            analyzed: 30,
            ingested: 12,
            failed: 3,
          },
        ],
      ]);
      setMockSql(mockDriver as unknown as SQL);

      const stats = await getStats();
      expect(stats.total).toBe(42);
      expect(stats.analyzed).toBe(30);
      expect(stats.ingested).toBe(12);
      expect(stats.failed).toBe(3);
      expect(mockDriver.queries[0]?.sql).toContain("SELECT");
      expect(mockDriver.queries[0]?.sql).toContain("COUNT");
    });
  });

  describe("markAnalyzed & markAnalysisFailed & markIngested", () => {
    test("يُحدّث التحليل والفشل والاستيعاب بشكل صحيح", async () => {
      const mockDriver = new MockSqlDriver([[], [], []]);
      setMockSql(mockDriver as unknown as SQL);

      await markAnalyzed("a1", {
        summary: ["ملخص"],
        facts: [],
        analysis: [],
        confidence: "high",
        entities: { organizations: [], people: [], places: [] },
      });
      expect(mockDriver.queries[0]?.sql).toContain("UPDATE articles");
      expect(mockDriver.queries[0]?.sql).toContain("analyzed = TRUE");
      expect(mockDriver.queries[0]?.values).toContain("a1");

      await markAnalysisFailed("a1", "خطأ في التحليل");
      expect(mockDriver.queries[1]?.sql).toContain("retry_count = retry_count + 1");
      expect(mockDriver.queries[1]?.values).toContain("خطأ في التحليل");

      await markIngested("a1");
      expect(mockDriver.queries[2]?.sql).toContain("ingested = TRUE");
    });
  });

  describe("initSchema", () => {
    test("ينفّذ `schema.sql` بدون أخطاء", async () => {
      const mockDriver = new MockSqlDriver([[]]);
      setMockSql(mockDriver as unknown as SQL);

      await initSchema();
      expect(mockDriver.queries).toHaveLength(1);
      expect(mockDriver.queries[0]?.sql).toContain("CREATE TABLE");
    });
  });
});
