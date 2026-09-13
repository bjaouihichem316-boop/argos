import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

/** Phase 1 queue: poll worldmonitor on a schedule. */
export const monitorQueue = new Queue("monitor-poll", { connection });

export async function enqueueMonitorPoll(limit = 20): Promise<void> {
  await monitorQueue.add(
    "poll",
    { limit, at: new Date().toISOString() },
    { removeOnComplete: 100, removeOnFail: 500 },
  );
}
