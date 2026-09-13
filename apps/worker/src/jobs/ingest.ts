import { getArticleById, getPendingIngest, getArticleWithAnalysis, markIngested } from "../db/client.js";
import { ingestArticle, type IngestResult } from "@argos/graph";
import type { Job } from "bullmq";

export interface IngestJobData {
  articleId: string;
}

/**
 * إدخال المقال المُحلّل إلى الرسم المعرفي (Neo4j).
 */
export async function runIngestJob(job: Job<IngestJobData, unknown, string>): Promise<{ articleId: string; ingested: boolean; result?: IngestResult }> {
  const { articleId } = job.data;

  const data = await getArticleWithAnalysis(articleId);
  if (!data) {
    console.log(`[ingest] لا يوجد تحليل أو مقال: ${articleId}`);
    return { articleId, ingested: false };
  }

  if (data.article.ingested) {
    console.log(`[ingest] المقال مُستوعب مسبقاً: ${articleId}`);
    return { articleId, ingested: true };
  }

  const { article, analysis } = data;

  const art = {
    id: article.id,
    title: article.title,
    body: article.body,
    source: article.source,
    url: article.url,
    publishedAt: article.published_at ?? undefined,
    lang: (article.lang as "ar" | "en" | "fr" | "other") ?? "ar",
    author: article.author ?? undefined,
    tags: article.tags ?? [],
  };

  const result = await ingestArticle(art, analysis);
  await markIngested(articleId);
  console.log(`[ingest] ✓ إدخال ناجح: ${articleId} — ${result.entityCount} كيان`);
  return { articleId, ingested: true, result };
}
