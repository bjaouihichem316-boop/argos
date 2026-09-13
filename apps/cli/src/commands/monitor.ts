import type { Command } from "commander";
import { WorldMonitorClient } from "@argos/monitor";

function fmtSignal(s: { id: string; title: string; source: string; severity: string; publishedAt?: string; url?: string }): string {
  const when = s.publishedAt ?? "—";
  const link = s.url ? `\n    ${s.url}` : "";
  return `• [${s.severity}] ${s.title}\n    ${s.source} · ${when}${link}`;
}

export function registerMonitorCommands(program: Command): void {
  const monitor = program.command("monitor").description("worldmonitor intel feed (Phase 1)");

  monitor
    .command("tools")
    .description("list MCP tools exposed by worldmonitor")
    .action(async () => {
      const client = WorldMonitorClient.fromEnv();
      const tools = await client.listTools();
      if (tools.length === 0) {
        console.log("(no tools — is WORLDMONITOR_MCP_URL reachable?)");
        return;
      }
      for (const t of tools) console.log(`• ${t.name}${t.description ? ` — ${t.description}` : ""}`);
    });

  monitor
    .command("latest")
    .description("show latest intel signals")
    .option("-l, --limit <n>", "how many", "10")
    .action(async (opts: { limit: string }) => {
      const limit = Math.min(50, Math.max(1, Number(opts.limit) || 10));
      const client = WorldMonitorClient.fromEnv();
      const signals = await client.getLatestSignals({ limit });
      if (signals.length === 0) {
        console.log("لا إشارات — no signals returned.");
        return;
      }
      console.log(signals.map(fmtSignal).join("\n"));
    });

  monitor
    .command("search <query>")
    .description("search intel signals")
    .option("-l, --limit <n>", "how many", "10")
    .action(async (query: string, opts: { limit: string }) => {
      const limit = Math.min(50, Math.max(1, Number(opts.limit) || 10));
      const client = WorldMonitorClient.fromEnv();
      const signals = await client.searchSignals(query, { limit });
      if (signals.length === 0) {
        console.log(`لا نتائج لـ "${query}" — no results.`);
        return;
      }
      console.log(signals.map(fmtSignal).join("\n"));
    });
}
