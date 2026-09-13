/**
 * Queue: analysis — تحليل المقالات المُنتظرة عبر Ollama.
 */
import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const analysisQueue = new Queue("analysis", { connection });

export interface AnalysisJobData {
  articleId: string;
}

export async function enqueueAnalysis(
  articleId: string,
  opts?: { attempts?: number; delay?: number },
): Promise<void> {
  await analysisQueue.add(
    "analyze",
    { articleId },
    {
      attempts: opts?.attempts ?? 3,
      backoff: { type: "exponential", delay: opts?.delay ?? 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}
