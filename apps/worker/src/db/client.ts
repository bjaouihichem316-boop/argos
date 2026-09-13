/**
 * @argos/worker — عميل قاعدة البيانات (DB client)
 *
 * يستخدم `Bun.SQL` (built-in `bun:sql`) بدون أي dependencies جديدة.
 * جميع العمليات عبر `.unsafe()` مع معاملات $1, $2, ... للأمان.
 */

import { SQL } from "bun";
import { type Article } from "@argos/core";
import { type ArticleAnalysis } from "@argos/ollama";

/** صف المقال كما يُخزّن ويُقرأ من الجدول. */
export interface ArticleRow {
  id: string;
  title: string;
  body: string;
  source: string;
  url: string;
  published_at: string | null;
  lang: string;
  author: string | null;
  tags: string[];
  analyzed: boolean;
  ingested: boolean;
  analysis: ArticleAnalysis | null;
  error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

/** مثيل SQL الوحيد (singleton) للاتصال بقاعدة البيانات. */
let sqlInstance: SQL | null = null;

/**
 * يضبط مثيل SQL مزيّف للاختبارات.
 * @param mock - مثيل `SQL` مزيّف.
 */
export function setMockSql(mock: SQL): void {
  sqlInstance = mock;
}

/**
 * يرجع مثيل SQL الوحيد.
 * @returns مثيل `Bun.SQL` متصل بـ DATABASE_URL.
 */
export function getDb(): SQL {
  if (!sqlInstance) {
    sqlInstance = new SQL(
      process.env.DATABASE_URL ??
        "postgres://argos:argos-local-dev@localhost:5432/argos",
    );
  }
  return sqlInstance;
}

/**
 * ينفّذ `schema.sql` لإنشاء الجداول والفهارس والزناد.
 */
export async function initSchema(): Promise<void> {
  const sql = getDb();
  const schemaPath = new URL("./schema.sql", import.meta.url);
  const schemaSql = await Bun.file(schemaPath).text();
  await sql.unsafe(schemaSql);
}

/**
 * يُدرج المقال أو يتجاهله إذا كان `url` موجوداً (`ON CONFLICT`).
 * @param article - المقال من `@argos/core`.
 * @returns `{ id, isNew }` حيث `isNew = true` إذا أُضيف فعلاً.
 */
export async function upsertArticle(
  article: Article,
): Promise<{ id: string; isNew: boolean }> {
  const sql = getDb();
  const tagsParam = sql.array(article.tags, "TEXT");

  const result = (await sql.unsafe(
    `INSERT INTO articles (
      id, title, body, source, url, published_at, lang, author, tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (url) DO NOTHING
    RETURNING id`,
    [
      article.id,
      article.title,
      article.body,
      article.source,
      article.url,
      article.publishedAt ? new Date(article.publishedAt) : null,
      article.lang,
      article.author ?? null,
      tagsParam,
    ],
  )) as Array<{ id: string }>;

  const isNew = result.length > 0;
  const insertedId = isNew && result[0] ? result[0].id : article.id;
  return { id: insertedId, isNew };
}

/**
 * يجلب المقالات التي لم تُحلّل بعد (`analyzed = FALSE`) مع حد المحاولات.
 * @param limit - عدد المقالات.
 */
export async function getPendingAnalysis(
  limit: number,
): Promise<ArticleRow[]> {
  const sql = getDb();
  const result = await sql.unsafe(
    `SELECT * FROM articles
     WHERE analyzed = FALSE
       AND retry_count < 3
     ORDER BY published_at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );
  return result as ArticleRow[];
}

/**
 * يجلب المقالات المُحلّلة والتي لم تُستوعب بعد (`analyzed = TRUE`, `ingested = FALSE`).
 * @param limit - عدد المقالات.
 */
export async function getPendingIngest(
  limit: number,
): Promise<ArticleRow[]> {
  const sql = getDb();
  const result = await sql.unsafe(
    `SELECT * FROM articles
     WHERE analyzed = TRUE
       AND ingested = FALSE
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );
  return result as ArticleRow[];
}

/**
 * يُحدّث المقال كأنه مُحلّل ويخزّن نتيجة التحليل (`analysis`) كـ JSONB.
 * @param id - معرّف المقال.
 * @param analysis - نتيجة `ArticleAnalysis` من `@argos/ollama`.
 */
export async function markAnalyzed(
  id: string,
  analysis: ArticleAnalysis,
): Promise<void> {
  const sql = getDb();
  await sql.unsafe(
    `UPDATE articles
     SET analyzed = TRUE,
         analysis = $2::jsonb,
         error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [id, analysis],
  );
}

/**
 * يُسجّل فشل التحليل ويزيد عدّاد المحاولات (`retry_count`).
 * @param id - معرّف المقال.
 * @param error - رسالة الخطأ.
 */
export async function markAnalysisFailed(
  id: string,
  error: string,
): Promise<void> {
  const sql = getDb();
  await sql.unsafe(
    `UPDATE articles
     SET retry_count = retry_count + 1,
         error = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [id, error],
  );
}

/**
 * يُحدّث المقال كأنه مُستوعب (`ingested = TRUE`).
 * @param id - معرّف المقال.
 */
export async function markIngested(id: string): Promise<void> {
  const sql = getDb();
  await sql.unsafe(
    `UPDATE articles
     SET ingested = TRUE,
         updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

/**
 * يُرجع إحصائيات الجدول: الكلّي، المُحلّل، المُستوعب، والفاشل (`retry_count > 0`).
 */
export async function getStats(): Promise<{
  total: number;
  analyzed: number;
  ingested: number;
  failed: number;
}> {
  const sql = getDb();
  const result = await sql.unsafe(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE analyzed = TRUE)::int AS analyzed,
       COUNT(*) FILTER (WHERE ingested = TRUE)::int AS ingested,
       COUNT(*) FILTER (WHERE retry_count > 0)::int AS failed
     FROM articles`,
  );
  const row = (result as Array<Record<string, unknown>>)[0];
  return {
    total: (row?.total as number) ?? 0,
    analyzed: (row?.analyzed as number) ?? 0,
    ingested: (row?.ingested as number) ?? 0,
    failed: (row?.failed as number) ?? 0,
  };
}
