/** @argos/tor — Tor + I2P fetcher (Phase 4). */
export const TOR_PHASE = 4 as const;

export {
  DEFAULT_TOR_SOCKS,
  DEFAULT_TOR_TIMEOUT_MS,
  TorFetchError,
  torFetchRaw,
  torFetchText,
  torFetchJson,
  checkTor,
  type TorFetchOptions,
} from "./fetch.js";
