/**
 * @argos/worker — Pipeline end-to-end تجريبي.
 *
 * يجيب مقالات من مصدر RSS، يحللها بـ Ollama، و يدخلها Neo4j.
 *
 * الاستعمال:
 *   bun run apps/worker/scripts/ingest-once.ts bbc-arabic 3
 *
 * Args:
 *   $1 — source id (default: bbc-arabic)
 *   $2 — limit (default: 3)
 */

import { fetchFeed, getSource, DEFAULT_SOURCES } from "@argos/aggregator";
import { analyzeArticle } from "@argos/ollama";
import { ingestArticle, verifyConnectivity, closeDriver } from "@argos/graph";
import type { Article } from "@argos/core";

interface StepResult {
  article: Article;
  analyzed: boolean;
  ingested: boolean;
  entityCount: number;
  relationshipCount: number;
  error?: string;
}

async function main() {
  const sourceId = process.argv[2] ?? "bbc-arabic";
  const limit = Number.parseInt(process.argv[3] ?? "3", 10);

  console.log("═══ ARGOS Ingest Pipeline ═══");
  console.log(`Source: ${sourceId}`);
  console.log(`Limit:  ${limit}\n`);

  // 1. تحقق من Neo4j
  const neo4jOk = await verifyConnectivity();
  if (!neo4jOk) {
    console.error("✗ Neo4j غير متصل — تحقق من Docker");
    process.exit(1);
  }
  console.log("✓ Neo4j متصل\n");

  // 2. اجلب المصدر
  const source = getSource(sourceId);
  if (!source) {
    console.error(`✗ مصدر غير معروف: ${sourceId}`);
    console.error("المصادر المتوفرة:", DEFAULT_SOURCES.map((s) => s.id).join(", "));
    process.exit(1);
  }

  // 3. اجلب الـ feed
  console.log(`→ جلب feed من ${source.name}...`);
  let articles: Article[];
  try {
    articles = await fetchFeed(source, limit);
  } catch (err) {
    console.error(`✗ فشل جلب feed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  console.log(`✓ ${articles.length} مقال\n`);

  // 4. لكل مقال: analyze + ingest
  const results: StepResult[] = [];
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i]!;
    console.log(`─── [${i + 1}/${articles.length}] ───`);
    console.log(`العنوان: ${article.title}`);
    console.log(`المصدر:  ${article.source}`);

    const result: StepResult = {
      article,
      analyzed: false,
      ingested: false,
      entityCount: 0,
      relationshipCount: 0,
    };

    // 4a. تحليل بـ Ollama
    console.log(`→ تحليل عبر Ollama...`);
    try {
      const analysis = await analyzeArticle(article);
      result.analyzed = true;
      console.log(`✓ تحليل: ${analysis.summary.length} ملخص، ${analysis.entities.organizations.length + analysis.entities.people.length + analysis.entities.places.length} كيان`);

      // 4b. إدخال في Neo4j
      console.log(`→ إدخال في Neo4j...`);
      const ingestResult = await ingestArticle(article, analysis);
      result.ingested = true;
      result.entityCount = ingestResult.entityCount;
      result.relationshipCount = ingestResult.relationshipCount;
      console.log(`✓ ingest: ${ingestResult.entityCount} كيانات، ${ingestResult.relationshipCount} علاقة`);
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      console.error(`✗ فشل: ${result.error}`);
    }

    results.push(result);
    console.log("");
  }

  // 5. ملخص نهائي
  console.log("═══ ملخص ═══");
  const ok = results.filter((r) => r.analyzed && r.ingested).length;
  const totalEntities = results.reduce((sum, r) => sum + r.entityCount, 0);
  const totalRelationships = results.reduce((sum, r) => sum + r.relationshipCount, 0);
  console.log(`✓ ${ok}/${results.length} مقال نجح`);
  console.log(`✓ مجموع: ${totalEntities} كيان، ${totalRelationships} علاقة`);

  // 6. cleanup
  await closeDriver();
}

main().catch((err) => {
  console.error("✗ خطأ غير متوقع:", err);
  process.exit(1);
});
