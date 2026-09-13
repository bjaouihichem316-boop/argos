import { Worker } from "bullmq";
import { runAnalysisJob } from "../jobs/analysis.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const analyzeWorker = new Worker(
  "analysis",
  async (job) => runAnalysisJob(job),
  { connection, concurrency: 1 },
);

analyzeWorker.on("completed", (job, result) =>
  console.log(`✓ analysis #${job.id} → ${JSON.stringify(result)}`),
);

analyzeWorker.on("failed", (job, err) =>
  console.error(`✗ analysis #${job?.id} failed: ${err.message}`),
);
