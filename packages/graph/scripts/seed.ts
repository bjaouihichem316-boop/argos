/**
 * سكريبت تجريبي لـ Phase 3 (GraphRAG).
 * يعمل: مقال تجريبي (خبر أبل) ← analyzeArticle ← ingestArticle ← findPathBetween ← طباعة.
 *
 * تشغيله: `bun packages/graph/scripts/seed.ts`
 * يتطلب: Ollama (للتحليل — مع fallback ثابت عند غيابه) و Neo4j على bolt://localhost:7687.
 */
import type { Article } from "@argos/core";
import { analyzeArticle } from "@argos/ollama";
import {
  closeDriver,
  findPathBetween,
  ingestArticle,
  normalizeEntities,
  verifyConnectivity,
  type ArticleAnalysis,
} from "../src/index.js";

/** مقال تجريبي: خبر استحواذ أبل. */
const APPLE_ARTICLE: Article = {
  id: "seed-apple-1",
  title: "أبل تستحوذ على شركة ناشئة في الذكاء الاصطناعي",
  body: "أعلنت شركة أبل اليوم استحواذها على شركة ناشئة متخصصة في الذكاء الاصطناعي مقرها كاليفورنيا. وقال تيم كوك إن الصفقة ستعزز قدرات أبل في هذا المجال.",
  source: "وكالة الأنباء",
  url: "https://example.com/articles/seed-apple-1",
  lang: "ar",
  tags: ["تقنية", "ذكاء اصطناعي"],
};

/** تحليل احتياطي عند غياب Ollama (نفس بنية مخرجات analyzeArticle). */
const FALLBACK_ANALYSIS: ArticleAnalysis = {
  summary: ["أبل تستحوذ على شركة ناشئة في الذكاء الاصطناعي.", "الصفقة ستعزز قدرات أبل حسب تيم كوك."],
  facts: ["المقر في كاليفورنيا.", "الإعلان اليوم."],
  analysis: ["توسّع أبل في سباق الذكاء الاصطناعي."],
  confidence: "medium",
  entities: {
    organizations: ["أبل", "شركة ناشئة"],
    people: ["تيم كوك"],
    places: ["كاليفورنيا"],
  },
};

async function main(): Promise<void> {
  console.log("── Phase 3 seed: Apple → Graph ──");

  if (!(await verifyConnectivity())) {
    console.error("✗ تعذّر الوصول إلى Neo4j (bolt://localhost:7687). تأكد أنه خدام ثم أعد المحاولة.");
    process.exitCode = 1;
    return;
  }
  console.log("✓ Neo4j متصل");

  let analysis: ArticleAnalysis;
  try {
    console.log("… تحليل المقال عبر Ollama");
    analysis = (await analyzeArticle(APPLE_ARTICLE)) as ArticleAnalysis;
    console.log("✓ التحليل عبر Ollama");
  } catch (err) {
    console.warn(`! Ollama غير متاح (${err instanceof Error ? err.message : String(err)}) — استعمال تحليل ثابت`);
    analysis = FALLBACK_ANALYSIS;
  }

  const ingested = await ingestArticle(APPLE_ARTICLE, analysis);
  console.log("✓ ingest:", JSON.stringify(ingested));

  const paths = await findPathBetween("أبل", "شركة ناشئة");
  console.log("✓ المسار بين «أبل» و«شركة ناشئة» (مطابقة حرفية):");
  console.log(JSON.stringify(paths, null, 2));

  // عرض توضيحي بأسماء حقيقية من التحليل (مخرجات الـ LLM تختلف صياغتها)
  const names = normalizeEntities(analysis).map((e) => e.nameAr);
  console.log("✓ كيانات التحليل:", JSON.stringify(names));
  if (names.length >= 2) {
    const demo = await findPathBetween(names[0] as string, names[1] as string);
    console.log(`✓ المسار بين «${names[0]}» و«${names[1]}»:`);
    console.log(JSON.stringify(demo, null, 2));
  }
}

try {
  await main();
} finally {
  await closeDriver();
}
