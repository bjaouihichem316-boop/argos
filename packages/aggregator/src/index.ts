/** @argos/aggregator — RSS aggregator (Phase 4). */
export const AGGREGATOR_PHASE = 4 as const;

export {
  DEFAULT_SOURCES,
  getSource,
  getSourcesByLang,
  type RssSource,
} from "./sources.js";

export {
  RssError,
  fetchFeed,
  normalizeItem,
  type RawFeedItem,
} from "./parser.js";
