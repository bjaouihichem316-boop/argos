/**
 * Queue: ingest — إدخال المقالات المُحلّلة إلى الرسم المعرفي (Neo4j).
 */
import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const ingestQueue = new Queue("ingest", { connection });

export interface IngestJobData {
  articleId: string;
}

export async function enqueueIngest(
  articleId: string,
  opts?: { attempts?: number; delay?: number },
): Promise<void> {
  await ingestQueue.add(
    "ingest",
    { articleId },
    {
      attempts: opts?.attempts ?? 2,
      backoff: { type: "exponential", delay: opts?.delay ?? 3000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}
