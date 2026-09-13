import { z } from "zod";
import { MonitorSignalSchema } from "@argos/core";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const SignalsResponse = z.object({ signals: z.array(MonitorSignalSchema) });

export async function fetchLatestSignals(limit = 10) {
  const res = await fetch(`${API_URL}/api/monitor/latest?limit=${limit}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return SignalsResponse.parse(await res.json()).signals;
}

export async function searchSignals(q: string, limit = 10) {
  const res = await fetch(
    `${API_URL}/api/monitor/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) throw new Error(`API ${res.status}`);
  return SignalsResponse.parse(await res.json()).signals;
}
