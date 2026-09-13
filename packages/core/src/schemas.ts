import { z } from "zod";

export const LangSchema = z.enum(["ar", "en", "fr", "other"]);
export const SeveritySchema = z.enum(["info", "low", "medium", "high", "critical", "unknown"]);
export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const MonitorSignalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  source: z.string().min(1),
  url: z.string().url().optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  lang: LangSchema.default("ar"),
  severity: SeveritySchema.default("info"),
  tags: z.array(z.string()).default([]),
  raw: z.unknown().optional(),
});

export const ArticleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  summary: z.string().optional(),
  source: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  lang: LangSchema.default("ar"),
  author: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const EntitySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["person", "org", "place", "event", "other"]),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  aliases: z.array(z.string()).default([]),
});

export const IntelEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titleAr: z.string().optional(),
  summaryAr: z.string().optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  place: z.string().optional(),
  confidence: ConfidenceSchema,
  entityIds: z.array(z.string()).default([]),
  articleIds: z.array(z.string()).default([]),
});

export const VideoJobSchema = z.object({
  id: z.string().min(1),
  articleId: z.string().optional(),
  eventId: z.string().optional(),
  headlineAr: z.string().min(1).max(90),
  scriptAr: z.string().min(1),
  status: z.enum(["queued", "rendering", "done", "failed"]),
  outputPath: z.string().optional(),
});

export const PaymentIntentSchema = z.object({
  id: z.string().min(1),
  amount: z.string().regex(/^\d+$/),
  currency: z.enum(["ETH", "USDC"]),
  chainId: z.number().int(),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  status: z.enum(["created", "pending", "settled", "failed"]),
});

export const McpToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
