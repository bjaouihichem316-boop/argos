import { getArticleById, getPendingAnalysis, markAnalyzed, markAnalysisFailed } from "../db/client.js";
import { analyzeArticle, type ArticleAnalysis } from "@argos/ollama";
import { type Article } from "@argos/core";
import type { Job } from "bullmq";

export interface AnalysisJobData {
  articleId: string;
}

/**
 * تحليل المقال المُنتظِر عبر Ollama.
 */
export async function runAnalysisJob(job: Job<AnalysisJobData, unknown, string>): Promise<{ articleId: string; analyzed: boolean; analysis?: ArticleAnalysis }> {
  const { articleId } = job.data;

  const row = await getArticleById(articleId);
  if (!row) {
    console.log(`[analysis] مقال غير موجود: ${articleId}`);
    return { articleId, analyzed: false };
  }

  if (row.analyzed) {
    console.log(`[analysis] المقال مُحلّل مسبقاً: ${articleId}`);
    return { articleId, analyzed: true, analysis: row.analysis ?? undefined };
  }

  const article: Article = {
    id: row.id,
    title: row.title,
    body: row.body,
    source: row.source,
    url: row.url,
    publishedAt: row.published_at ?? undefined,
    lang: (row.lang as "ar" | "en" | "fr" | "other") ?? "ar",
    author: row.author ?? undefined,
    tags: row.tags ?? [],
  };

  try {
    const analysis = await analyzeArticle(article);
    await markAnalyzed(articleId, analysis);
    console.log(`[analysis] ✓ تحليل ناجح: ${articleId}`);
    return { articleId, analyzed: true, analysis };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markAnalysisFailed(articleId, message);
    console.error(`[analysis] ✗ فشل تحليل ${articleId}:`, message);
    throw err;
  }
}
