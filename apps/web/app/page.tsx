"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    articles: 0,
    analyzed: 0,
    ingested: 0,
    entities: 0,
    relationships: 0,
    sources: 0,
  });
  const [articles, setArticles] = useState<any[]>([]);
  const [status, setStatus] = useState({ db: true, graph: true, ollama: true });

  useEffect(() => {
    fetch("http://localhost:8787/api/stats")
      .then((r) => r.json())
      .then((d) => setStats({ ...stats, ...d }))
      .catch(() => setStatus({ ...status, db: false }));

    fetch("http://localhost:8787/api/articles?limit=10")
      .then((r) => r.json())
      .then((d) => setArticles(d.articles ?? []))
      .catch(() => setStatus({ ...status, db: false }));

    fetch("http://localhost:8787/api/graph/network?limit=10")
      .then(() => setStatus({ ...status, graph: true }))
      .catch(() => setStatus({ ...status, graph: false }));
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-[#e6f1ff] px-6 py-12 font-sans">
      <header className="max-w-6xl mx-auto mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-[#00d9ff] mb-2">ARGOS Dashboard</h1>
        <p className="text-zinc-400 text-sm">الاستخبارات الإخبارية — لوحة التحكم</p>
      </header>

      {/* Stats Cards */}
      <section className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
        {[
          { label: "المقالات", value: stats.articles },
          { label: "مُحلّلة", value: stats.analyzed },
          { label: "مُستوعبة", value: stats.ingested },
          { label: "كيانات", value: stats.entities },
          { label: "علاقات", value: stats.relationships },
          { label: "مصادر", value: stats.sources },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-[#00d9ff]/40 transition shadow-sm"
          >
            <div className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</div>
            <div className="text-3xl font-mono font-bold text-[#00d9ff] mt-2">{s.value}</div>
          </motion.div>
        ))}
      </section>

      {/* System Status */}
      <section className="max-w-6xl mx-auto mb-12">
        <h2 className="text-lg font-semibold mb-4 text-[#e6f1ff]">حالة الأنظمة</h2>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status.db ? "bg-emerald-400" : "bg-red-500"}`}></span>
            <span>Postgres DB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status.graph ? "bg-emerald-400" : "bg-red-500"}`}></span>
            <span>Neo4j Graph</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status.ollama ? "bg-emerald-400" : "bg-red-500"}`}></span>
            <span>Ollama LLM</span>
          </div>
        </div>
      </section>

      {/* Live Articles Feed */}
      <section className="max-w-6xl mx-auto mb-12">
        <h2 className="text-lg font-semibold mb-4 text-[#e6f1ff]">آخر المقالات</h2>
        <div className="space-y-3">
          {articles.map((a: any) => (
            <Link key={a.id} href={`/articles/${a.id}`} className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-[#00d9ff]/40 transition">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-[#e6f1ff]">{a.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{a.source} • {a.publishedAt ? new Date(a.publishedAt).toLocaleString("ar-EG") : "—"}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  {a.analyzed ? <span className="text-emerald-400">مُحلّلة</span> : <span className="text-amber-400">قيد التحليل</span>}
                  {a.ingested ? <span className="text-cyan-400">مُستوعبة</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <nav className="max-w-6xl mx-auto flex gap-4 text-sm">
        <Link href="/graph" className="text-[#00d9ff] underline hover:text-cyan-300">الرسم المعرفي →</Link>
        <Link href="/articles" className="text-[#00d9ff] underline hover:text-cyan-300">قائمة المقالات →</Link>
      </nav>
    </main>
  );
}
