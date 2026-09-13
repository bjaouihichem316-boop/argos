#!/usr/bin/env bash
set -euo pipefail
# Local dev: infra + turbo dev
docker compose -f infra/docker/docker-compose.yml up -d
bun install
bun run dev
