import { WorldMonitorClient } from "@argos/monitor";

export interface PollJobData {
  limit: number;
  at: string;
}

/** Phase 1 job: fetch latest signals. Postgres persistence lands in Phase 2. */
export async function runMonitorPoll(data: PollJobData): Promise<{ count: number }> {
  const client = WorldMonitorClient.fromEnv();
  const signals = await client.getLatestSignals({ limit: data.limit });
  console.log(`[monitor-poll] ${signals.length} signals @ ${data.at}`);
  // TODO Phase 2: upsert into Postgres (dedupe by id/url hash).
  return { count: signals.length };
}
