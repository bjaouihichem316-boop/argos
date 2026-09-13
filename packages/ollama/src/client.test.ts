/**
 * اختبارات عميل Ollama (`bun test`).
 * كل الاختبارات تستعمل `fetch` وهمية — لا تحتاج خادم Ollama حقيقياً.
 *
 * تشغيلها: `bun test packages/ollama`
 */
import { describe, expect, test } from "bun:test";
import type { Article } from "@argos/core";
import {
  analyzeArticle,
  chat,
  cleanForeignChars,
  cleanValue,
  embed,
  extractJson,
  generate,
  listModels,
  OllamaError,
  ParseError,
  resolveHost,
} from "./client.js";

// ─── أدوات مساعدة للاختبارات ───────────────────────────────────────────

/** تصنع `fetch` وهمية من دالة معالجة، مع تسجيل آخر طلب. */
function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
    return handler(url, init);
  }) as typeof fetch;
}

/** رد `Response` بـ JSON وحالة HTTP قابلة للتخصيص. */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** مقال عربي ثابت للاختبارات. */
const SAMPLE_ARTICLE: Article = {
  id: "art-test-1",
  title: "افتتاح محطة طاقة شمسية جديدة في الجنوب",
  body: "افتتحت وزارة الطاقة اليوم محطة للطاقة الشمسية بقدرة 100 ميغاواط. وقال الوزير إن المشروع سيوفر الكهرباء لآلاف المنازل.",
  source: "وكالة الأنباء",
  url: "https://example.com/articles/1",
  lang: "ar",
  tags: [],
};

/** تحليل صالح يطابق `ArticleAnalysisSchema`. */
const VALID_ANALYSIS = {
  summary: ["افتتاح محطة شمسية بقدرة 100 ميغاواط.", "المشروع سيغذي آلاف المنازل بالكهرباء."],
  facts: ["القدرة 100 ميغاواط.", "الافتتاح اليوم."],
  analysis: ["خطوة نحو تنويع مصادر الطاقة."],
  confidence: "high",
  entities: {
    organizations: ["وزارة الطاقة"],
    people: ["الوزير"],
    places: ["الجنوب"],
  },
};

// ─── chat ──────────────────────────────────────────────────────────────

describe("chat", () => {
  test("يرجع محتوى الرد مع النموذج", async () => {
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    const fetchFn = mockFetch((url, init) => {
      seenUrl = url;
      seenBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        model: "falcon-h1-ar",
        message: { role: "assistant", content: "مرحباً بك في ARGOS" },
        done: true,
        total_duration: 1234,
      });
    });

    const res = await chat({
      messages: [{ role: "user", content: "مرحباً" }],
      fetchFn,
    });

    expect(res.content).toBe("مرحباً بك في ARGOS");
    expect(res.model).toBe("falcon-h1-ar");
    expect(res.done).toBe(true);
    expect(res.totalDuration).toBe(1234);
    expect(seenUrl.endsWith("/api/chat")).toBe(true);
    expect(seenBody["stream"]).toBe(false);
    expect(seenBody["model"]).toBe("falcon-h1-ar");
  });

  test("يحقن system prompt كأول رسالة ويمرر temperature", async () => {
    let seenBody: Record<string, unknown> = {};
    const fetchFn = mockFetch((_url, init) => {
      seenBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        model: "falcon-h1-ar",
        message: { role: "assistant", content: "ok" },
        done: true,
      });
    });

    await chat({
      messages: [{ role: "user", content: "سؤال" }],
      system: "أنت محلل عربي",
      temperature: 0.1,
      format: "json",
      fetchFn,
    });

    const messages = seenBody["messages"] as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toBe("أنت محلل عربي");
    expect(seenBody["format"]).toBe("json");
    const options = seenBody["options"] as { temperature: number };
    expect(options.temperature).toBe(0.1);
  });

  test("يرمي OllamaError مع status و body عند HTTP error", async () => {
    const fetchFn = mockFetch(() => jsonResponse({ error: "model not found" }, 404));
    try {
      await chat({ messages: [{ role: "user", content: "hi" }], fetchFn });
      throw new Error("كان يجب أن يرمي خطأ");
    } catch (err) {
      expect(err).toBeInstanceOf(OllamaError);
      expect((err as OllamaError).status).toBe(404);
      expect((err as OllamaError).body).toContain("model not found");
    }
  });

  test("يرمي ParseError عندما يكون الرد JSON غير صالح", async () => {
    const fetchFn = mockFetch(() => new Response("not-json{{{", { status: 200 }));
    try {
      await chat({ messages: [{ role: "user", content: "hi" }], fetchFn });
      throw new Error("كان يجب أن يرمي خطأ");
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
    }
  });

  test("يرمي OllamaError عند انتهاء المهلة", async () => {
    const hanging: typeof fetch = ((_input: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;
    try {
      await chat({ messages: [{ role: "user", content: "hi" }], timeoutMs: 50, fetchFn: hanging });
      throw new Error("كان يجب أن يرمي خطأ");
    } catch (err) {
      expect(err).toBeInstanceOf(OllamaError);
      expect((err as OllamaError).message).toContain("50");
    }
  });
});

// ─── generate ──────────────────────────────────────────────────────────

describe("generate", () => {
  test("يرجع حقل response كنص", async () => {
    let seenUrl = "";
    const fetchFn = mockFetch((url) => {
      seenUrl = url;
      return jsonResponse({ model: "falcon-h1-ar", response: "عنوان بديل", done: true });
    });
    const res = await generate({ prompt: "اقترح عنواناً", fetchFn });
    expect(res.content).toBe("عنوان بديل");
    expect(seenUrl.endsWith("/api/generate")).toBe(true);
  });
});

// ─── embed ─────────────────────────────────────────────────────────────

describe("embed", () => {
  test("يرجع المتجه ويستعمل bge-m3 افتراضياً", async () => {
    let seenBody: Record<string, unknown> = {};
    const fetchFn = mockFetch((_url, init) => {
      seenBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({ embedding: [0.1, 0.2, 0.3] });
    });
    const res = await embed({ input: "نص الخبر", fetchFn });
    expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(seenBody["model"]).toBe("bge-m3");
    expect(seenBody["prompt"]).toBe("نص الخبر");
  });
});

// ─── listModels ────────────────────────────────────────────────────────

describe("listModels", () => {
  test("يرجع أسماء النماذج من /api/tags", async () => {
    let seenUrl = "";
    const fetchFn = mockFetch((url) => {
      seenUrl = url;
      return jsonResponse({
        models: [{ name: "falcon-h1-ar:latest" }, { name: "bge-m3:latest" }],
      });
    });
    const models = await listModels("http://localhost:11434", fetchFn);
    expect(models).toEqual(["falcon-h1-ar:latest", "bge-m3:latest"]);
    expect(seenUrl.endsWith("/api/tags")).toBe(true);
  });
});

// ─── analyzeArticle ────────────────────────────────────────────────────

describe("analyzeArticle", () => {
  test("يرجع ArticleAnalysis صحيحاً بعد التحقق بـ Zod", async () => {
    let seenBody: Record<string, unknown> = {};
    const fetchFn = mockFetch((_url, init) => {
      seenBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        model: "falcon-h1-ar",
        message: { role: "assistant", content: JSON.stringify(VALID_ANALYSIS) },
        done: true,
      });
    });

    const result = await analyzeArticle(SAMPLE_ARTICLE, { fetchFn });

    expect(result.summary).toHaveLength(2);
    expect(result.confidence).toBe("high");
    expect(result.entities.organizations).toContain("وزارة الطاقة");
    expect(result.entities.places).toContain("الجنوب");
    // format: json يُمرَّر دائماً في التحليل
    expect(seenBody["format"]).toBe("json");
  });

  test("يتسامح مع تسييج ```json من النموذج", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        model: "falcon-h1-ar",
        message: {
          role: "assistant",
          content: "```json\n" + JSON.stringify(VALID_ANALYSIS) + "\n```",
        },
        done: true,
      }),
    );
    const result = await analyzeArticle(SAMPLE_ARTICLE, { fetchFn });
    expect(result.confidence).toBe("high");
  });

  test("يرمي ParseError عندما لا يطابق التحليل المخطط", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        model: "falcon-h1-ar",
        message: { role: "assistant", content: JSON.stringify({ bogus: true }) },
        done: true,
      }),
    );
    try {
      await analyzeArticle(SAMPLE_ARTICLE, { fetchFn });
      throw new Error("كان يجب أن يرمي خطأ");
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
    }
  });
});

// ─── extractJson ───────────────────────────────────────────────────────

describe("extractJson", () => {
  test("يستخرج JSON المحاط بنص زائد", () => {
    const parsed = extractJson('إليك التحليل: {"a": 1} انتهى.') as { a: number };
    expect(parsed.a).toBe(1);
  });
});

describe("cleanForeignChars", () => {
  test('يزيل Cyrillic: "قاعدة военных" → "قاعدة"', () => {
    expect(cleanForeignChars("قاعدة военных")).toBe("قاعدة ");
  });
  test('يزيل CJK: "هدف 目标" → "هدف"', () => {
    expect(cleanForeignChars("هدف 目标")).toBe("هدف ");
  });
  test('يزيل Korean و Japanese', () => {
    expect(cleanForeignChars("مرحبا 한국 日本")).toBe("مرحبا  ");
  });
});

describe("cleanValue", () => {
  test("ينظف نصوصاً داخل كائن متداخل", () => {
    const result = cleanValue({
      name: "الحوثيون военных",
      list: ["القوات 目标", "الرياض"],
      meta: { tag: "日本" },
    }) as { name: string; list: string[]; meta: { tag: string } };
    expect(result.name).toBe("الحوثيون ");
    expect(result.list).toEqual(["القوات ", "الرياض"]);
    expect(result.meta.tag).toBe("");
  });
});

// ─── resolveHost ───────────────────────────────────────────────────────

describe("resolveHost", () => {
  test('يضيف http:// عند غياب البروتوكول: "127.0.0.1:11434"', () => {
    expect(resolveHost("127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
  });

  test('يبدّل bind address ويضيف البروتوكول: "0.0.0.0:11434"', () => {
    expect(resolveHost("0.0.0.0:11434")).toBe("http://127.0.0.1:11434");
  });

  test('يُبقي العنوان السليم كما هو: "http://localhost:11434"', () => {
    expect(resolveHost("http://localhost:11434")).toBe("http://localhost:11434");
  });

  test('يُبقي https كما هو: "https://ollama.local"', () => {
    expect(resolveHost("https://ollama.local")).toBe("https://ollama.local");
  });

  test('يبدّل 0.0.0.0 ويحيّد trailing slash: "http://0.0.0.0:11434/"', () => {
    expect(resolveHost("http://0.0.0.0:11434/")).toBe("http://127.0.0.1:11434");
  });

  test('يرجع الافتراضي عند القيمة الفارغة: ""', () => {
    expect(resolveHost("")).toBe("http://localhost:11434");
  });
});
