/**
 * @argos/aggregator — مصادر RSS العربية و الدولية.
 *
 * ملاحظة: المصادر الرسمية فقط (RSS feeds عامة)، بلا Tor (للأداء).
 * لـ .onion و المواقع المحجوبة → استعمل @argos/tor.
 */

export interface RssSource {
  id: string;
  name: string;
  url: string;
  lang: "ar" | "en" | "fr";
  region?: string;
  category?: "general" | "politics" | "business" | "tech" | "world";
  credibility?: "high" | "medium" | "low";
}

export const DEFAULT_SOURCES: RssSource[] = [
  {
    id: "aljazeera-ar",
    name: "الجزيرة",
    url: "https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9",
    lang: "ar",
    region: "QA",
    category: "general",
    credibility: "high",
  },
  {
    id: "bbc-arabic",
    name: "BBC عربي",
    url: "https://feeds.bbci.co.uk/arabic/rss.xml",
    lang: "ar",
    region: "UK",
    category: "general",
    credibility: "high",
  },
  {
    id: "france24-ar",
    name: "فرانس 24 عربي",
    url: "https://www.france24.com/ar/rss",
    lang: "ar",
    region: "FR",
    category: "general",
    credibility: "high",
  },
  {
    id: "alarabiya",
    name: "العربية",
    url: "https://www.alarabiya.net/feed/rss2/ar.xml",
    lang: "ar",
    region: "AE",
    category: "general",
    credibility: "medium",
  },
  {
    id: "rt-arabic",
    name: "RT عربي",
    url: "https://arabic.rt.com/rss/",
    lang: "ar",
    region: "RU",
    category: "general",
    credibility: "low",
  },
  {
    id: "alquds",
    name: "القدس العربي",
    url: "https://www.alquds.co.uk/feed/",
    lang: "ar",
    region: "UK",
    category: "politics",
    credibility: "medium",
  },
  {
    id: "reuters-world",
    name: "Reuters World",
    url: "https://feeds.reuters.com/reuters/worldNews",
    lang: "en",
    category: "world",
    credibility: "high",
  },
  {
    id: "ap-topnews",
    name: "AP Top News",
    url: "https://apnews.com/hub/ap-top-news.rss",
    lang: "en",
    category: "world",
    credibility: "high",
  },
];

export function getSource(id: string): RssSource | undefined {
  return DEFAULT_SOURCES.find((s) => s.id === id);
}

export function getSourcesByLang(lang: RssSource["lang"]): RssSource[] {
  return DEFAULT_SOURCES.filter((s) => s.lang === lang);
}
