/**
 * @argos/core — shared domain types.
 * Single source of truth. All apps/packages import from here.
 * Zod schemas live in ./schemas.ts (runtime validation).
 */

export type Lang = "ar" | "en" | "fr" | "other";
export type Severity = "info" | "low" | "medium" | "high" | "critical" | "unknown";
export type Confidence = "low" | "medium" | "high";

export interface MonitorSignal {
  id: string;
  title: string;
  summary?: string;
  source: string;
  url?: string;
  publishedAt?: string; // ISO-8601
  lang: Lang;
  severity: Severity;
  tags: string[];
  raw?: unknown;
}

export interface Article {
  id: string;
  title: string;
  body: string;
  summary?: string;
  source: string;
  url: string;
  publishedAt?: string;
  lang: Lang;
  author?: string;
  tags: string[];
}

export interface Entity {
  id: string;
  kind: "person" | "org" | "place" | "event" | "other";
  name: string;
  nameAr?: string;
  aliases: string[];
}

export interface IntelEvent {
  id: string;
  title: string;
  titleAr?: string;
  summaryAr?: string;
  occurredAt?: string;
  place?: string;
  confidence: Confidence;
  entityIds: string[];
  articleIds: string[];
}

export interface VideoJob {
  id: string;
  articleId?: string;
  eventId?: string;
  headlineAr: string;
  scriptAr: string;
  status: "queued" | "rendering" | "done" | "failed";
  outputPath?: string;
}

export interface PaymentIntent {
  id: string;
  amount: string; // wei, string to avoid precision loss
  currency: "ETH" | "USDC";
  chainId: number;
  to: `0x${string}`;
  status: "created" | "pending" | "settled" | "failed";
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}
