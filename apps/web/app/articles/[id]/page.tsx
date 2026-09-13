"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function ArticleDetailPage() {
  const params = useParams() as { id: string };
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    if (params.id) {
      fetch(`http://localhost:8787/api/articles/${params.id}`)
        .then((r) => r.json())
        .then((d) => setArticle(d.article ?? null))
        .catch(() => setArticle(null));
    }
  }, [params.id]);

  if (!article) {
    return (
      <main className="min-h-screen bg-[#0a0e1a] text-[#e6f1ff] px-6 py-10">
        <div className="max-w-4xl mx-auto text-zinc-500">جارٍ التحميل...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-[#e6f1ff] px-6 py-10">
      <article className="max-w-4xl mx-auto">
        <a href="/articles" className="text-sm text-[#00d9ff] hover:underline">← العودة إلى المقالات</a>
        <h1 className="text-3xl font-extrabold mt-6 mb-4 leading-tight">{article.title}</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-400 mb-8">
          <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{article.source}</span>
          <span>•</span>
          <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleString("ar-EG") : "—"}</span>
          <span>•</span>
          <span className={article.analyzed ? "text-emerald-400" : "text-amber-400"}>
            {article.analyzed ? "مُحلّلة" : "قيد التحليل"}
          </span>
        </div>

        <div className="prose prose-invert max-w-none mb-8 text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {article.body || "لا محتوى متاح."}
        </div>

        {article.tags && article.tags.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {article.tags.map((t: string) => (
              <span key={t} className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-zinc-300">{t}</span>
            ))}
          </div>
        )}
      </article>
    </main>
  );
}
