/**
 * @argos/graph — إدخال المقال إلى الرسم المعرفي (Phase 3).
 *
 * يأخذ `Article` (من `@argos/core`) وتحليله `ArticleAnalysis` ويخزنهما في Neo4j:
 * - `MERGE` عقدة `Article` (idempotent — تكرار الإدخال لا يضاعف العقد)
 * - `MERGE` عقد الكيانات من `normalizeEntities`
 * - `MERGE` علاقة `(Article)-[:MENTIONS]->(Entity)`
 * - `MERGE` علاقات التزامن `(Entity)-[:CO_OCCURS_WITH {articleId}]->(Entity)`
 *   لكل زوج كيانات في نفس المقال (موحّدة الاتجاه بترتيب المعرّفات)
 *
 * كل الكتابة بـ Cypher مع `UNWIND` للعمليات الدفعية، وبـ `MERGE` لا `CREATE`.
 */
import { ArticleSchema, type Article } from "@argos/core";
import { z } from "zod";
import { type ArticleAnalysis, normalizeEntities } from "./entities.js";
import { getSession, type SessionLike } from "./neo4j.js";

/** نتيجة إدخال مقال إلى الرسم. */
export const IngestResultSchema = z.object({
  /** معرّف المقال المُدخل. */
  articleId: z.string().min(1),
  /** عدد الكيانات المطبّعة (عقد `Entity`). */
  entityCount: z.number().int().min(0),
  /** مجموع العلاقات: `MENTIONS` + `CO_OCCURS_WITH`. */
  relationshipCount: z.number().int().min(0),
});
/** نتيجة إدخال مقال إلى الرسم. */
export type IngestResult = z.infer<typeof IngestResultSchema>;

/** استعلام إنشاء/تحديث عقدة المقال (idempotent). */
export const UPSERT_ARTICLE_CYPHER = [
  "MERGE (a:Article {id: $article.id})",
  "SET a.title = $article.title,",
  "    a.body = $article.body,",
  "    a.source = $article.source,",
  "    a.url = $article.url,",
  "    a.publishedAt = $article.publishedAt,",
  "    a.lang = $article.lang",
].join("\n");

/** استعلام دفعي للكيانات وعلاقات الذكر (idempotent). */
export const UPSERT_ENTITIES_CYPHER = [
  "MATCH (a:Article {id: $articleId})",
  "UNWIND $entities AS e",
  "MERGE (en:Entity {id: e.id})",
  "SET en.kind = e.kind,",
  "    en.name = e.name,",
  "    en.nameAr = e.nameAr,",
  "    en.aliases = e.aliases",
  "MERGE (a)-[:MENTIONS]->(en)",
].join("\n");

/** استعلام دفعي لعلاقات التزامن بين كل زوج كيانات (idempotent لكل مقال). */
export const UPSERT_COOCCURRENCE_CYPHER = [
  "UNWIND $pairs AS p",
  "MATCH (x:Entity {id: p.fromId}), (y:Entity {id: p.toId})",
  "MERGE (x)-[:CO_OCCURS_WITH {articleId: $articleId}]->(y)",
].join("\n");

/**
 * يُدخل مقالاً وتحليله إلى الرسم المعرفي.
 * idempotent: تكرار الاستدعاء بنفس المقال لا ينشئ عقداً/علاقات مكررة.
 *
 * @param article المقال (يُتحقق عبر `ArticleSchema` من `@argos/core`)
 * @param analysis نتيجة `analyzeArticle`
 * @param session جلسة Neo4j اختيارية (للاختبارات — تُستعمل كما هي دون إغلاق).
 *   عند غيابها تُفتح جلسة من الـ Driver المشترك وتُغلق تلقائياً.
 * @returns `{ articleId, entityCount, relationshipCount }`
 */
export async function ingestArticle(
  article: Article,
  analysis: ArticleAnalysis,
  session?: SessionLike,
): Promise<IngestResult> {
  const parsedArticle = ArticleSchema.safeParse(article);
  if (!parsedArticle.success) {
    throw new Error(`ingestArticle: مقال غير صالح (${parsedArticle.error.message})`);
  }
  const entities = normalizeEntities(analysis);
  const art = parsedArticle.data;

  // كل زوج كيانات (i<j) → علاقة واحدة باتجاه مرتب حتمياً (idempotent)
  const ids = entities.map((e) => e.id).sort();
  const pairs: Array<{ fromId: string; toId: string }> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push({ fromId: ids[i] as string, toId: ids[j] as string });
    }
  }

  const run = async (s: SessionLike): Promise<IngestResult> => {
    await s.run(UPSERT_ARTICLE_CYPHER, {
      article: {
        id: art.id,
        title: art.title,
        body: art.body,
        source: art.source,
        url: art.url,
        publishedAt: art.publishedAt ?? null,
        lang: art.lang,
      },
    });
    if (entities.length > 0) {
      await s.run(UPSERT_ENTITIES_CYPHER, {
        articleId: art.id,
        entities: entities.map((e) => ({
          id: e.id,
          kind: e.kind,
          name: e.name,
          nameAr: e.nameAr,
          aliases: e.aliases,
        })),
      });
    }
    if (pairs.length > 0) {
      await s.run(UPSERT_COOCCURRENCE_CYPHER, { articleId: art.id, pairs });
    }
    return {
      articleId: art.id,
      entityCount: entities.length,
      relationshipCount: entities.length + pairs.length,
    };
  };

  if (session) return run(session);
  const owned = getSession();
  try {
    return await run(owned as unknown as SessionLike);
  } finally {
    await owned.close();
  }
}
