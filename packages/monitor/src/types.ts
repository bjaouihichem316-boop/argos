/** Config for the worldmonitor MCP client. */

export interface WorldMonitorConfig {
  /** Streamable-HTTP MCP endpoint, e.g. http://localhost:3100/mcp */
  url: string;
  /** Optional bearer key (WORLDMONITOR_API_KEY) */
  apiKey?: string;
  /** Request timeout in ms (default 15000) */
  timeoutMs?: number;
  /** Custom fetch (for tests / edge runtimes) */
  fetchFn?: typeof fetch;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export const DEFAULT_TIMEOUT_MS = 15_000;
