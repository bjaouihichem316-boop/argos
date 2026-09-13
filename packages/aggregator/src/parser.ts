/**
 * @argos/aggregator — RSS/Atom parser.
 *
 * يحوّل feeds خام إلى Article objects (من @argos/core).
 */

import Parser from "rss-parser";
import type { Article, Lang } from "@argos/core";
import type { RssSource } from "./sources.js";

/** parser instance (reuse — rss-parser يخزّن بعض الحالة الداخلية). */
const parser = new Parser({
  timeout: 30_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    "Accept-Language": "ar,en;q=0.9",
  },
});

/** خطأ مخصص لكل عمليات RSS. */
export class RssError extends Error {
  public readonly code = "RSS_ERROR" as const;
  constructor(
    message: string,
    public readonly sourceId?: string,
    public readonly url?: string,
    opts?: { cause?: unknown },
  ) {
    super(message, opts);
    this.name = "RssError";
  }
}

/** عنصر RSS/Atom خام. */
export interface RawFeedItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  categories?: string[];
}

/** يبني Article ID من المصدر + الـ URL. */
function buildArticleId(sourceId: string, url: string): string {
  // hash بسيط deterministic
  let hash = 0;
  const key = `${sourceId}::${url}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return `${sourceId}-${Math.abs(hash).toString(36)}`;
}

/** يحلّل تاريخ feed → ISO 8601 إذا ممكن. */
function parseDate(item: RawFeedItem): string | undefined {
  const raw = item.isoDate ?? item.pubDate;
  if (!raw) return undefined;

  // قد يكون Date object من rss-parser
  const d = (raw as unknown) instanceof Date ? (raw as unknown as Date) : new Date(raw as string);

  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** يحوّل RawFeedItem → Article. */
export function normalizeItem(
  item: RawFeedItem,
  source: RssSource,
): Article | null {
  if (!item.title || !item.link) return null;

  const body =
    item.content ??
    item.contentSnippet ??
    item.title;

  return {
    id: buildArticleId(source.id, item.link),
    title: item.title.trim(),
    body: body.trim(),
    source: source.name,
    url: item.link,
    publishedAt: parseDate(item),
    lang: source.lang as Lang,
    author: item.creator,
    tags: item.categories ?? [],
  };
}

/**
 * يجيب feed و يرجّع Articles مُنَظَّمة.
 *
 * @param source — المصدر (من sources.ts).
 * @param limit — حد أقصى لعدد المقالات (default 20).
 * @param fetchFn — دالة fetch بديلة (للاختبار).
 */
export async function fetchFeed(
  source: RssSource,
  limit = 20,
  fetchFn?: typeof fetch,
): Promise<Article[]> {
  let feed;
  try {
    // rss-parser يستعمل http internally؛ نمرّر له fetch مخصص إذا لزم
    // أما هنا نستعملو parseURL مباشرة (يستعمل http get افتراضي)
    feed = await parser.parseURL(source.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new RssError(
      `فشل جلب feed من ${source.name}: ${msg}`,
      source.id,
      source.url,
      { cause: err },
    );
  }

  const items = (feed.items ?? []).slice(0, limit);
  const articles: Article[] = [];
  for (const item of items) {
    const art = normalizeItem(item as RawFeedItem, source);
    if (art) articles.push(art);
  }
  return articles;
}
