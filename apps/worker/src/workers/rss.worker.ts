import { Worker } from "bullmq";
import { runAggregateJob } from "../jobs/aggregate.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const rssWorker = new Worker(
  "rss-fetch",
  async (job) => runAggregateJob(job),
  { connection, concurrency: 1 },
);

rssWorker.on("completed", (job, result) =>
  console.log(`✓ rss-fetch #${job.id} → ${JSON.stringify(result)}`),
);

rssWorker.on("failed", (job, err) =>
  console.error(`✗ rss-fetch #${job?.id} failed: ${err.message}`),
);
