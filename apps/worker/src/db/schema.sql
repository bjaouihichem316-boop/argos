-- ARGOS — جدول المقالات (articles)
-- المصدر: @argos/core → @argos/worker

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  published_at TIMESTAMPTZ,
  lang TEXT DEFAULT 'ar',
  author TEXT,
  tags TEXT[] DEFAULT '{}',
  analyzed BOOLEAN DEFAULT FALSE,
  ingested BOOLEAN DEFAULT FALSE,
  analysis JSONB,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- الفهارس الجزئية (partial indexes) للأداء
CREATE INDEX IF NOT EXISTS idx_articles_analyzed ON articles(analyzed) WHERE analyzed = FALSE;
CREATE INDEX IF NOT EXISTS idx_articles_ingested ON articles(ingested) WHERE ingested = FALSE;
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- دالة التحديث التلقائي لـ updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- الزناد على جدول articles
DROP TRIGGER IF EXISTS set_updated_at ON articles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
