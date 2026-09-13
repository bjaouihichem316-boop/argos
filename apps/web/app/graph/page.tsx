"use client";

import { useState, useEffect, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";

export default function GraphPage() {
  const [data, setData] = useState({ nodes: [] as any[], links: [] as any[] });
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:8787/api/graph/network?limit=50")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData({ nodes: d.nodes || [], links: d.links || [] });
        }
      })
      .catch(() => setData({ nodes: [], links: [] }));
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-[#e6f1ff] px-6 py-10">
      <header className="max-w-6xl mx-auto mb-6">
        <h1 className="text-3xl font-extrabold text-[#00d9ff]">الرسم المعرفي — Neo4j</h1>
        <p className="text-zinc-400 text-sm">عرض الكيانات والعلاقات من التحليل</p>
      </header>

      <div className="max-w-6xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden h-[70vh] shadow-inner">
        <ForceGraph2D
          graphData={data}
          nodeLabel="label"
          nodeAutoColorBy="group"
          backgroundColor="#0a0e1a"
          linkColor={() => "#334155"}
          linkWidth={1.5}
          onNodeClick={(node: any) => setSelected(node)}
        />
      </div>

      {selected && (
        <aside className="max-w-6xl mx-auto mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm">
          <h3 className="font-bold text-[#00d9ff] mb-2">{selected.name ?? selected.id}</h3>
          <p className="text-zinc-400">المعرّف: <span className="font-mono text-[#e6f1ff]">{selected.id}</span></p>
          <p className="text-zinc-400">النوع: <span className="font-mono text-[#e6f1ff]">{selected.group}</span></p>
        </aside>
      )}
    </main>
  );
}
