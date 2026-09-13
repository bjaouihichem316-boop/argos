import { Worker } from "bullmq";
import { runIngestJob } from "../jobs/ingest.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const ingestWorker = new Worker(
  "ingest",
  async (job) => runIngestJob(job),
  { connection, concurrency: 1 },
);

ingestWorker.on("completed", (job, result) =>
  console.log(`✓ ingest #${job.id} → ${JSON.stringify(result)}`),
);

ingestWorker.on("failed", (job, err) =>
  console.error(`✗ ingest #${job?.id} failed: ${err.message}`),
);
