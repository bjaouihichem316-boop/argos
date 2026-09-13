"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", "30");
    if (source) params.set("source", source);
    fetch(`http://localhost:8787/api/articles?${params}`)
      .then((r) => r.json())
      .then((d) => setArticles(d.articles ?? []))
      .catch(() => setArticles([]));
  }, [source]);

  const filtered = articles.filter((a: any) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? []).join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-[#e6f1ff] px-6 py-10">
      <header className="max-w-6xl mx-auto mb-8">
        <h1 className="text-3xl font-extrabold text-[#00d9ff]">المقالات</h1>
        <p className="text-zinc-400 text-sm">كل المقالات المُخزّنة</p>
      </header>

      <section className="max-w-6xl mx-auto mb-6 flex gap-3">
        <input
          type="text"
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm focus:outline-none focus:border-[#00d9ff]"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm focus:outline-none focus:border-[#00d9ff]"
        >
          <option value="">كل المصادر</option>
          <option value="المصدر">المصدر</option>
          <option value="اختبار">اختبار</option>
        </select>
      </section>

      <section className="max-w-6xl mx-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="text-zinc-500 border-b border-zinc-800">
            <tr>
              <th className="text-left py-3 px-3">العنوان</th>
              <th className="text-left py-3 px-3">المصدر</th>
              <th className="text-left py-3 px-3">التاريخ</th>
              <th className="text-left py-3 px-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((a: any) => (
              <tr key={a.id} className="hover:bg-zinc-900/30">
                <td className="py-3 px-3">
                  <Link href={`/articles/${a.id}`} className="text-[#e6f1ff] hover:text-[#00d9ff] font-medium">
                    {a.title}
                  </Link>
                </td>
                <td className="py-3 px-3 text-zinc-400">{a.source}</td>
                <td className="py-3 px-3 text-zinc-400 font-mono text-xs">
                  {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("ar-EG") : "—"}
                </td>
                <td className="py-3 px-3">
                  <span className={`text-xs font-mono ${a.analyzed ? "text-emerald-400" : "text-amber-400"}`}>
                    {a.analyzed ? "مُحلّلة" : "قيد"}
                  </span>
                  {a.ingested ? <span className="ml-2 text-cyan-400 text-xs">مُستوعبة</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
