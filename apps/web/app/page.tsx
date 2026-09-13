import { ConnectButton } from "@rainbow-me/rainbowkit";
import { fetchLatestSignals } from "../lib/api-client";

export const dynamic = "force-dynamic";

const SEVERITY_AR: Record<string, string> = {
  info: "معلومة",
  low: "منخفض",
  medium: "متوسط",
  high: "عالٍ",
  critical: "حرج",
  unknown: "غير معروف",
};

export default async function Home() {
  let signals: Awaited<ReturnType<typeof fetchLatestSignals>> = [];
  let error: string | null = null;
  try {
    signals = await fetchLatestSignals(10);
  } catch (e) {
    error = e instanceof Error ? e.message : "تعذّر الاتصال بالـ API";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">ARGOS 🛰️</h1>
          <p className="text-zinc-400 mt-1">منصة استخبارات إخبارية — محلية أولاً • عربية أولاً</p>
        </div>
        <ConnectButton />
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">أحدث الإشارات — worldmonitor</h2>
        {error ? (
          <div className="rounded border border-red-800 bg-red-950/40 p-4 text-sm">
            تعذّر جلب الإشارات ({error}). تأكد أن <code dir="ltr">apps/api</code> يعمل على
            :8787 وأن <code dir="ltr">WORLDMONITOR_MCP_URL</code> مضبوط.
          </div>
        ) : signals.length === 0 ? (
          <p className="text-zinc-400">لا إشارات بعد — no signals yet.</p>
        ) : (
          <ul className="space-y-3">
            {signals.map((s) => (
              <li key={s.id} className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="rounded bg-zinc-800 px-2 py-0.5">
                    {SEVERITY_AR[s.severity] ?? s.severity}
                  </span>
                  <span>{s.source}</span>
                  {s.publishedAt ? <span dir="ltr">{s.publishedAt}</span> : null}
                </div>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                {s.summary ? <p className="mt-1 text-sm text-zinc-300">{s.summary}</p> : null}
                {s.url ? (
                  <a href={s.url} target="_blank" className="mt-2 inline-block text-sm text-emerald-400 underline">
                    المصدر
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 text-xs text-zinc-500">
        Phase 1 — الهيكل + worldmonitor client • <span dir="ltr">AGPL-3.0</span>
      </footer>
    </main>
  );
}
