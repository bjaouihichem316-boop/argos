import { Worker } from "bullmq";
import { runMonitorPoll, type PollJobData } from "./jobs/poll.js";
import { enqueueMonitorPoll } from "./queues/monitor.js";
import { runAnalysisJob, type AnalysisJobData } from "./jobs/analysis.js";
import { enqueueAnalysis } from "./queues/analysis.js";
import { runIngestJob, type IngestJobData } from "./jobs/ingest.js";
import { enqueueIngest } from "./queues/ingest.js";
import { runAggregateJob, type AggregateJobData } from "./jobs/aggregate.js";
import { enqueueAggregate } from "./queues/aggregate.js";
import { getPendingAnalysis, getPendingIngest } from "./db/client.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

// ─── Queue workers ───────────────────────────────────────────────────────

const monitorWorker = new Worker<PollJobData>(
  "monitor-poll",
  async (job) => runMonitorPoll(job.data),
  { connection },
);

monitorWorker.on("completed", (job, result) =>
  console.log(`✓ monitor-poll #${job.id} → ${JSON.stringify(result)}`),
);
monitorWorker.on("failed", (job, err) =>
  console.error(`✗ monitor-poll #${job?.id} failed: ${err.message}`),
);

const analysisWorker = new Worker<AnalysisJobData>(
  "analysis",
  async (job) => runAnalysisJob(job),
  { connection },
);

analysisWorker.on("completed", (job, result) =>
  console.log(`✓ analysis #${job.id} (${result.articleId}) → analyzed=${result.analyzed}`),
);
analysisWorker.on("failed", (job, err) =>
  console.error(`✗ analysis #${job?.id} (${job?.data?.articleId}) failed: ${err.message}`),
);

const ingestWorker = new Worker<IngestJobData>(
  "ingest",
  async (job) => runIngestJob(job),
  { connection },
);

ingestWorker.on("completed", (job, result) =>
  console.log(`✓ ingest #${job.id} (${result.articleId}) → ingested=${result.ingested}`),
);
ingestWorker.on("failed", (job, err) =>
  console.error(`✗ ingest #${job?.id} (${job?.data?.articleId}) failed: ${err.message}`),
);

const aggregateWorker = new Worker<AggregateJobData>(
  "aggregate",
  async (job) => runAggregateJob(job),
  { connection },
);

aggregateWorker.on("completed", (job, result) =>
  console.log(`✓ aggregate #${job.id} (${result.sourceName}) → inserted=${result.inserted}`),
);
aggregateWorker.on("failed", (job, err) =>
  console.error(`✗ aggregate #${job?.id} failed: ${err.message}`),
);

// ─── Main entry ────────────────────────────────────────────────────────────

if (import.meta.main) {
  console.log("◆ ARGOS worker up — queues: monitor-poll | analysis | ingest | aggregate");

  // Phase 1 cadence: poll every 5 min
  setInterval(() => enqueueMonitorPoll(20).catch(console.error), 5 * 60 * 1000);
  await enqueueMonitorPoll(20).catch((e) =>
    console.error("initial poll failed (is worldmonitor up?):", e.message),
  );

  // Schedule analysis sweep every 2 min (Phase 2 automation)
  setInterval(async () => {
    const pending = await getPendingAnalysis(5);
    for (const row of pending) {
      await enqueueAnalysis(row.id, { attempts: 3 });
    }
  }, 2 * 60 * 1000);

  // Schedule ingest sweep every 3 min (Phase 3 automation)
  setInterval(async () => {
    const pending = await getPendingIngest(3);
    for (const row of pending) {
      await enqueueIngest(row.id, { attempts: 2 });
    }
  }, 3 * 60 * 1000);
}
