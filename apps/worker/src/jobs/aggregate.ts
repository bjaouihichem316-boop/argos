import { fetchFeed, type RssSource } from "@argos/aggregator";
import { upsertArticle } from "../db/client.js";
import type { Job } from "bullmq";

export interface AggregateJobData {
  sourceName: string;
  url: string;
}

/**
 * جلب خلاصات RSS من مصدر معين وإدخالها إلى DB.
 */
export async function runAggregateJob(job: Job<AggregateJobData, unknown, string>): Promise<{ sourceName: string; inserted: number; skipped: number }> {
  const { sourceName, url } = job.data;

  const source: RssSource = {
    id: sourceName,
    name: sourceName,
    url,
    lang: "ar",
  };

  const articles = await fetchFeed(source, 20);

  let inserted = 0;
  let skipped = 0;

  for (const art of articles) {
    try {
      const result = await upsertArticle(art);
      if (result.isNew) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`[aggregate] ✗ خطأ في إدخال ${art.id}:`, err);
    }
  }

  console.log(`[aggregate] ${sourceName}: ${inserted} جديد، ${skipped} موجود`);
  return { sourceName, inserted, skipped };
}
