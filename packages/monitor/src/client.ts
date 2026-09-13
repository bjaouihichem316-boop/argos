import { McpToolSchema, MonitorSignalSchema, type McpTool, type MonitorSignal } from "@argos/core";
import { z } from "zod";
import { DEFAULT_TIMEOUT_MS, type JsonRpcResponse, type WorldMonitorConfig } from "./types.js";

export class MonitorUnavailableError extends Error {
  readonly code = "MONITOR_UNAVAILABLE";
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = "MonitorUnavailableError";
    this.cause = opts?.cause;
  }
}

const ToolsListResult = z.object({
  tools: z.array(McpToolSchema),
});

const CallToolResult = z.object({
  content: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

/**
 * Minimal MCP (Model Context Protocol) client for the `worldmonitor` intel server.
 * Transport: Streamable HTTP (JSON-RPC 2.0 POST). No SSE, no stdio — Phase 1 only.
 *
 * @example
 * ```ts
 * const client = new WorldMonitorClient({ url: process.env.WORLDMONITOR_MCP_URL! });
 * const signals = await client.getLatestSignals({ limit: 5 });
 * ```
 */
export class WorldMonitorClient {
  private url: string;
  private apiKey?: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;
  private rpcId = 0;

  constructor(config: WorldMonitorConfig) {
    if (!config.url) throw new Error("WorldMonitorClient: `url` is required (WORLDMONITOR_MCP_URL)");
    this.url = config.url.replace(/\/$/, "");
    this.apiKey = config.apiKey || undefined;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /** Build from environment variables (WORLDMONITOR_MCP_URL / _API_KEY / _TIMEOUT_MS). */
  static fromEnv(overrides?: Partial<WorldMonitorConfig>): WorldMonitorClient {
    return new WorldMonitorClient({
      url: process.env.WORLDMONITOR_MCP_URL ?? "http://localhost:3100/mcp",
      apiKey: process.env.WORLDMONITOR_API_KEY || undefined,
      timeoutMs: process.env.WORLDMONITOR_TIMEOUT_MS
        ? Number(process.env.WORLDMONITOR_TIMEOUT_MS)
        : DEFAULT_TIMEOUT_MS,
      ...overrides,
    });
  }

  // ─── low-level JSON-RPC ─────────────────────────────────

  private async rpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = ++this.rpcId;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new MonitorUnavailableError(`worldmonitor MCP HTTP ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as JsonRpcResponse<T>;
      if (data.error) {
        throw new MonitorUnavailableError(`worldmonitor MCP error ${data.error.code}: ${data.error.message}`);
      }
      return data.result as T;
    } catch (err) {
      if (err instanceof MonitorUnavailableError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new MonitorUnavailableError(`worldmonitor unreachable (${msg})`, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── MCP primitives ─────────────────────────────────────

  /** List tools exposed by the worldmonitor server. */
  async listTools(): Promise<McpTool[]> {
    const result = await this.rpc<unknown>("tools/list");
    const parsed = ToolsListResult.safeParse(result);
    if (!parsed.success) {
      throw new MonitorUnavailableError("worldmonitor returned invalid tools/list shape");
    }
    return parsed.data.tools;
  }

  /** Call a raw MCP tool by name. Returns parsed `structuredContent` or `content[].text` JSON. */
  async callTool<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
    const result = await this.rpc<unknown>("tools/call", { name, arguments: args ?? {} });
    const parsed = CallToolResult.safeParse(result);
    if (!parsed.success) return result as T;
    if (parsed.data.isError) {
      const text = parsed.data.content?.[0]?.text ?? "unknown tool error";
      throw new MonitorUnavailableError(`worldmonitor tool \`${name}\` failed: ${text}`);
    }
    if (parsed.data.structuredContent !== undefined) return parsed.data.structuredContent as T;
    const text = parsed.data.content?.find((c) => c.text)?.text;
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // ─── high-level helpers ─────────────────────────────────

  private pickTool(tools: McpTool[], candidates: string[]): string | undefined {
    const names = tools.map((t) => t.name);
    for (const c of candidates) {
      const exact = names.find((n) => n === c);
      if (exact) return exact;
    }
    for (const c of candidates) {
      const fuzzy = names.find((n) => n.toLowerCase().includes(c));
      if (fuzzy) return fuzzy;
    }
    return undefined;
  }

  private toSignals(input: unknown): MonitorSignal[] {
    const arr = Array.isArray(input)
      ? input
      : (input as { signals?: unknown })?.signals ?? (input as { items?: unknown })?.items ?? [];
    const list = Array.isArray(arr) ? arr : [arr];
    const out: MonitorSignal[] = [];
    for (const item of list) {
      const parsed = MonitorSignalSchema.safeParse(item);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  }

  /** Latest intel signals. Auto-discovers the `latest`-ish tool, falls back to `get_latest`. */
  async getLatestSignals(opts?: { limit?: number }): Promise<MonitorSignal[]> {
    const limit = opts?.limit ?? 10;
    const tools = await this.listTools().catch(() => [] as McpTool[]);
    const name =
      this.pickTool(tools, ["get_latest_signals", "get_latest", "latest_signals", "latest", "signals"]) ??
      "get_latest";
    const raw = await this.callTool(name, { limit });
    return this.toSignals(raw).slice(0, limit);
  }

  /** Full-text search over signals. Auto-discovers the `search`-ish tool. */
  async searchSignals(query: string, opts?: { limit?: number }): Promise<MonitorSignal[]> {
    const q = query.trim();
    if (q.length < 2) throw new Error("searchSignals: query must be ≥ 2 chars");
    const limit = opts?.limit ?? 10;
    const tools = await this.listTools().catch(() => [] as McpTool[]);
    const name =
      this.pickTool(tools, ["search_signals", "search", "query", "find"]) ?? "search_signals";
    const raw = await this.callTool(name, { q, query: q, limit });
    return this.toSignals(raw).slice(0, limit);
  }
}
