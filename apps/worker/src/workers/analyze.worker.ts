import { Worker } from "bullmq";
import { runAnalysisJob } from "../jobs/analysis.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const analyzeWorker = new Worker(
  "analyze",
  async (job) => runAnalysisJob(job),
  { connection, concurrency: 1 },
);

analyzeWorker.on("completed", (job, result) =>
  console.log(`✓ analyze #${job.id} → ${JSON.stringify(result)}`),
);

analyzeWorker.on("failed", (job, err) =>
  console.error(`✗ analyze #${job?.id} failed: ${err.message}`),
);
