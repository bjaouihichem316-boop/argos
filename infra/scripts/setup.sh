#!/usr/bin/env bash
set -euo pipefail
# ARGOS setup — checks Bun/Docker, prepares .env, pulls Ollama model.

echo "── ARGOS setup ──"

command -v bun >/dev/null || { echo "❌ bun not found. Install: https://bun.sh"; exit 1; }
command -v docker >/dev/null || { echo "❌ docker not found."; exit 1; }
echo "✓ bun $(bun --version) + docker $(docker --version | head -c 40)"

[ -f .env ] || { cp .env.example .env; echo "✓ created .env from .env.example"; }
[ -f .env ] && echo "✓ .env exists"

echo "→ docker compose up -d (neo4j + postgres + redis)…"
docker compose -f infra/docker/docker-compose.yml up -d

echo "→ bun install…"
bun install

if command -v ollama >/dev/null; then
  echo "→ ollama create falcon-h1-ar…"
  ollama create falcon-h1-ar -f Modelfiles/falcon-h1-ar.Modelfile || echo "⚠ ollama create failed — run manually"
else
  echo "⚠ ollama not found locally — skip (or: docker compose --profile ollama up -d)"
fi

echo "✅ setup done. Run: bun run dev"
