# ARGOS — منصة استخبارات إخبارية OSINT
# ARGOS — OSINT News Intelligence Platform

> **محلية أولاً • عربية أولاً • crypto-native**
> **Local-first • Arabic-first • crypto-native**

---

## 🇹🇳 / 🇩🇿 / 🇲🇦 بالعربية

**ARGOS** هي منصة استخبارات مفتوحة المصدر (OSINT) تجمع الأخبار من الويب، الشبكات الاجتماعية، وTor/I2P، تحللها بالذكاء الاصطناعي المحلي (Ollama)، وتبني رسمًا معرفيًا (Knowledge Graph) للأحداث والشخصيات والعلاقات، ثم تولّد فيديوهات إخبارية تلقائيًا.

### المبادئ

1. **محلية أولاً (Local-first):** كل شيء يعمل على جهازك — Ollama + Neo4j + Postgres + Redis عبر Docker. لا إرسال لبيانات حساسة إلى سحابات أجنبية.
2. **عربية أولاً (Arabic-first):** النماذج والتحليل والواجهة مصممة للعربية (بلهجاتها) قبل الإنجليزية. موديل `falcon-h1-ar` مخصص لهذا.
3. **crypto-native:** الدفع بالكريبتو عبر Base L2 و Paylix. لا Stripe، لا PayPal، لا وسطاء.

### البنية (Phase 1)

```
argos/
├── apps/
│   ├── web/         Next.js 15 + Tailwind + RainbowKit (الواجهة)
│   ├── api/         Hono on Bun (الـ API)
│   ├── worker/      BullMQ jobs (المهام الخلفية)
│   └── cli/         Commander.js (سطر الأوامر)
├── packages/
│   ├── core/        shared types + zod schemas
│   ├── monitor/     worldmonitor MCP client ← Phase 1 يبدأ هنا
│   ├── aggregator/  RSS aggregator
│   ├── tor/         Tor + I2P fetcher
│   ├── graph/       Neo4j + GraphRAG
│   ├── video/       Playwright + FFmpeg + TTS
│   ├── payments/    paylix SDK wrapper
│   └── ollama/      Ollama client + Modelfiles
├── infra/docker/    Neo4j + Postgres + Redis
└── docs/            ARCHITECTURE / ROADMAP / API
```

### التشغيل السريع — Quickstart

```bash
# 1. المتطلبات: Bun + Docker
bun --version        # >= 1.1.0
docker --version

# 2. انسخ البيئة
cp .env.example .env

# 3. شغّل البنية التحتية (Neo4j + Postgres + Redis)
bun run docker:up
# أو: docker compose -f infra/docker/docker-compose.yml up -d

# 4. ثبّت الاعتماديات
bun install

# 5. شغّل كل شيء (Turborepo)
bun run dev

# 6. جرّب الـ CLI
bun run cli -- --help
bun run cli -- monitor latest --limit 5
```

| الخدمة | الرابط |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:8787 |
| Neo4j Browser | http://localhost:7474 |
| Ollama | http://localhost:11434 |

### الـ Phases

| Phase | المحتوى | الحالة |
|---|---|---|
| 1 | الهيكل + `worldmonitor` MCP client | ✅ الآن |
| 2 | RSS aggregator + Ollama تحليل عربي | ⏳ |
| 3 | Neo4j GraphRAG | ⏳ |
| 4 | Tor/I2P fetcher | ⏳ |
| 5 | Video generation (Playwright+FFmpeg+TTS) | ⏳ |
| 6 | Paylix crypto payments على Base | ⏳ |

انظر `docs/ROADMAP.md` للتفاصيل.

---

## 🇬🇧 In English

**ARGOS** is an open-source OSINT news-intelligence platform. It ingests news from the web, social feeds and Tor/I2P, analyzes it with local LLMs (Ollama), builds an event/entity knowledge graph, then auto-generates news videos.

### Principles

1. **Local-first:** everything runs on your machine — Ollama + Neo4j + Postgres + Redis via Docker. No sensitive data leaves your box.
2. **Arabic-first:** models, analysis and UI are designed for Arabic (incl. dialects) before English. The `falcon-h1-ar` Modelfile serves this.
3. **crypto-native:** crypto payments via Base L2 + Paylix. No Stripe, no PayPal, no middlemen.

### Quickstart

```bash
cp .env.example .env
bun run docker:up
bun install
bun run dev
bun run cli -- monitor latest --limit 5
```

See `docs/ARCHITECTURE.md` and `docs/API.md` for details.

---

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
