/** @argos/aggregator — RSS aggregator (Phase 2). */
export const AGGREGATOR_PHASE = 2 as const;

export interface FetchFeedOptions {
  url: string;
  limit?: number;
}

/** Phase 2 stub — implemented in Phase 2. */
export async function fetchFeed(_opts: FetchFeedOptions): Promise<never> {
  throw new Error("@argos/aggregator.fetchFeed — Phase 2 not implemented yet (see docs/ROADMAP.md)");
}
