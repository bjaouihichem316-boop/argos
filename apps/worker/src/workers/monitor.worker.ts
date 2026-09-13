import { Worker } from "bullmq";
import { runMonitorPoll } from "../jobs/poll.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const monitorWorker = new Worker(
  "monitor-poll",
  async (job) => runMonitorPoll(job.data),
  { connection, concurrency: 1 },
);

monitorWorker.on("completed", (job, result) =>
  console.log(`✓ monitor-poll #${job.id} → ${JSON.stringify(result)}`),
);

monitorWorker.on("failed", (job, err) =>
  console.error(`✗ monitor-poll #${job?.id} failed: ${err.message}`),
);
