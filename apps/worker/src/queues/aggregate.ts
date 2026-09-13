/**
 * Queue: aggregate — جلب خلاصات RSS + إدخالها إلى DB.
 */
import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const aggregateQueue = new Queue("aggregate", { connection });

export interface AggregateJobData {
  sourceName: string;
  url: string;
}

export async function enqueueAggregate(
  sourceName: string,
  url: string,
  opts?: { delay?: number },
): Promise<void> {
  await aggregateQueue.add(
    "aggregate",
    { sourceName, url },
    {
      delay: opts?.delay ?? 0,
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  );
}
