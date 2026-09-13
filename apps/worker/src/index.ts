import { Worker } from "bullmq";
import { runMonitorPoll, type PollJobData } from "./jobs/poll.js";
import { enqueueMonitorPoll } from "./queues/monitor.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

const worker = new Worker<PollJobData>(
  "monitor-poll",
  async (job) => runMonitorPoll(job.data),
  { connection },
);

worker.on("completed", (job, result) =>
  console.log(`✓ monitor-poll #${job.id} → ${JSON.stringify(result)}`),
);
worker.on("failed", (job, err) =>
  console.error(`✗ monitor-poll #${job?.id} failed: ${err.message}`),
);

if (import.meta.main) {
  console.log("◆ ARGOS worker up — queue: monitor-poll");
  // Enqueue one poll every 5 min (Phase 1 cadence).
  setInterval(() => enqueueMonitorPoll(20).catch(console.error), 5 * 60 * 1000);
  await enqueueMonitorPoll(20).catch((e) =>
    console.error("initial poll failed (is worldmonitor up?):", e.message),
  );
}
