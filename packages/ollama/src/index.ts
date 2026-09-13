/** @argos/ollama — Ollama client (Phase 2). */
export const OLLAMA_PHASE = 2 as const;
export const DEFAULT_MODEL = "falcon-h1-ar";
export const DEFAULT_HOST = "http://localhost:11434";

export interface ChatOptions {
  host?: string;
  model?: string;
  prompt: string;
  system?: string;
}

/** Phase 2 stub — implemented in Phase 2. Full client wraps OLLAMA_HOST chat/embed. */
export async function chat(_opts: ChatOptions): Promise<never> {
  throw new Error("@argos/ollama.chat — Phase 2 not implemented yet (see docs/ROADMAP.md)");
}
