import { enqueueMonitorPoll } from "./queues/monitor.js";
import { enqueueAnalysis } from "./queues/analysis.js";
import { enqueueIngest } from "./queues/ingest.js";
import { enqueueAggregate } from "./queues/aggregate.js";
import { DEFAULT_SOURCES } from "@argos/aggregator";
import { getPendingAnalysis, getPendingIngest } from "./db/client.js";

// ─── Queue workers (from workers/ folder) ────────────────────────────────
import { monitorWorker } from "./workers/monitor.worker.js"; // existing
import { rssWorker } from "./workers/rss.worker.js";
import { analyzeWorker } from "./workers/analyze.worker.js";
import { ingestWorker } from "./workers/ingest.worker.js";

// Re-export workers for external usage
export { rssWorker, analyzeWorker, ingestWorker, monitorWorker };

// ─── Main entry ────────────────────────────────────────────────────────────

if (import.meta.main) {
  console.log("◆ ARGOS worker up — queues: monitor-poll | rss-fetch | analyze | ingest");

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

  // Schedule aggregate (RSS) sweep every 15 min (Phase 4 automation)
  setInterval(async () => {
    for (const source of DEFAULT_SOURCES) {
      await enqueueAggregate(source.id, source.url).catch(console.error);
    }
  }, 15 * 60 * 1000);

  // Initial RSS fetch call
  for (const source of DEFAULT_SOURCES) {
    await enqueueAggregate(source.id, source.url).catch(console.error);
  }
}
