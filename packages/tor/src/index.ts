/** @argos/tor — Tor + I2P fetcher (Phase 4). */
export const TOR_PHASE = 4 as const;

/** Phase 4 stub — implemented in Phase 4. */
export async function torFetch(_url: string): Promise<never> {
  throw new Error("@argos/tor.torFetch — Phase 4 not implemented yet (see docs/ROADMAP.md)");
}
