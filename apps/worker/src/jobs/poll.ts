import { WorldMonitorClient } from "@argos/monitor";
import { upsertArticle } from "../db/client.js";
import { type Article } from "@argos/core";

export interface PollJobData {
  limit: number;
  at: string;
}

/** Phase 1 job: fetch latest signals + persist into Postgres (dedupe by url). */
export async function runMonitorPoll(data: PollJobData): Promise<{ count: number; inserted: number; skipped: number }> {
  const client = WorldMonitorClient.fromEnv();
  const signals = await client.getLatestSignals({ limit: data.limit });
  console.log(`[monitor-poll] ${signals.length} signals @ ${data.at}`);

  let inserted = 0;
  let skipped = 0;
  for (const signal of signals.slice(0, data.limit)) {
    const article: Article = {
      id: signal.id,
      title: signal.title,
      body: signal.summary ?? signal.title,
      source: signal.source,
      url: signal.url ?? `https://worldmonitor.local/signal/${signal.id}`,
      publishedAt: signal.publishedAt,
      lang: signal.lang,
      author: undefined,
      tags: signal.tags ?? [],
    };
    const result = await upsertArticle(article);
    if (result.isNew) inserted++;
    else skipped++;
  }
  return { count: signals.length, inserted, skipped };
}
