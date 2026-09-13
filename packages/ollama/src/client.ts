/**
 * @argos/ollama — عميل HTTP حقيقي لـ Ollama (Phase 2).
 *
 * يغلّف Ollama HTTP API محلياً:
 * - `POST /api/chat` للمحادثة (نموذج `falcon-h1-ar`)
 * - `POST /api/generate` للـ prompt المفرد
 * - `POST /api/embeddings` للتضمينات (نموذج `bge-m3`)
 * - `GET /api/tags` لسرد النماذج المتاحة
 *
 * plus دالة عالية المستوى `analyzeArticle` تحلّل مقالاً عربياً
 * وتعيد نتيجة مُتحقّقاً منها بـ Zod.
 *
 * يعتمد على `fetch` الأصلي في Bun — لا dependencies جديدة (فقط `zod`).
 */
import { z } from "zod";
import type { Article } from "@argos/core";

// ─── الإعدادات الافتراضية ─────────────────────────────────────────────

/**
 * النموذج الافتراضي للمحادثة والتحليل (عربي، مبني على Falcon-H1).
 * @see Modelfiles/falcon-h1-ar.Modelfile
 */
export const DEFAULT_MODEL = "falcon-h1-ar";

/** النموذج الافتراضي للتضمينات (متعدد اللغات، يدعم العربية). */
export const DEFAULT_EMBED_MODEL = "bge-m3";

/**
 * عنوان خادم Ollama الافتراضي.
 * يُقرأ من متغير البيئة `OLLAMA_HOST` وإلا `http://localhost:11434`.
 * يُطبَّع عبر `resolveHost` (يتحمّل غياب البروتوكول وعنوان الـ bind `0.0.0.0`).
 */
export const DEFAULT_HOST: string = resolveHost(process.env.OLLAMA_HOST);

/**
 * مهلة الطلبات بالمللي ثانية (دقيقتان — النموذج بطيء نسبياً على CPU).
 */
export const TIMEOUT_MS = 120_000;

/** اسم بديل لنفس المهلة (توافق مع تسمية المخطط). */
export const TIMEOUT = TIMEOUT_MS;

/** حجم السياق الافتراضي المُمرَّر لـ Ollama (مطابق للـ Modelfile). */
export const DEFAULT_NUM_CTX = 16_384;

/** درجة الحرارة الافتراضية (مطابقة للـ Modelfile — تحليل واقعي قليل العشوائية). */
export const DEFAULT_TEMPERATURE = 0.2;

// ─── الأنواع الأساسية ─────────────────────────────────────────────────

/** دور الرسالة في المحادثة. */
export type ChatRole = "system" | "user" | "assistant";

/** رسالة محادثة واحدة (متوافقة مع Ollama `/api/chat`). */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** خيارات دالة `chat`. */
export interface ChatOptions {
  /** عنوان الخادم (افتراضياً `DEFAULT_HOST`). */
  host?: string;
  /** النموذج (افتراضياً `DEFAULT_MODEL`). */
  model?: string;
  /** رسائل المحادثة بالترتيب. */
  messages: ChatMessage[];
  /** تعليمات النظام — تُحقن كأول رسالة `system` إذا زُوّدت. */
  system?: string;
  /** `'json'` لتفعيل وضع JSON في Ollama. */
  format?: "json";
  /** درجة الحرارة (افتراضياً `DEFAULT_TEMPERATURE`). */
  temperature?: number;
  /** حجم السياق `num_ctx` (افتراضياً `DEFAULT_NUM_CTX`). */
  numCtx?: number;
  /** المهلة بالمللي ثانية (افتراضياً `TIMEOUT_MS`). */
  timeoutMs?: number;
  /** دالة `fetch` مخصصة (للاختبارات أو بيئات خاصة). */
  fetchFn?: typeof fetch;
}

/** خيارات دالة `generate` (prompt مفرد، بدون سجل محادثة). */
export interface GenerateOptions {
  /** عنوان الخادم (افتراضياً `DEFAULT_HOST`). */
  host?: string;
  /** النموذج (افتراضياً `DEFAULT_MODEL`). */
  model?: string;
  /** نص الـ prompt. */
  prompt: string;
  /** تعليمات النظام (تُمرَّر في حقل `system`). */
  system?: string;
  /** `'json'` لتفعيل وضع JSON في Ollama. */
  format?: "json";
  /** درجة الحرارة (افتراضياً `DEFAULT_TEMPERATURE`). */
  temperature?: number;
  /** حجم السياق `num_ctx` (افتراضياً `DEFAULT_NUM_CTX`). */
  numCtx?: number;
  /** المهلة بالمللي ثانية (افتراضياً `TIMEOUT_MS`). */
  timeoutMs?: number;
  /** دالة `fetch` مخصصة (للاختبارات أو بيئات خاصة). */
  fetchFn?: typeof fetch;
}

/** رد موحّد لدالتي `chat` و `generate`. */
export interface ChatResponse {
  /** نص رد النموذج. */
  content: string;
  /** اسم النموذج الذي رد فعلاً. */
  model: string;
  /** هل اكتمل التوليد (دائماً `true` لأننا نطلب `stream: false`). */
  done: boolean;
  /** مدة التنفيذ الكلية بالنانو ثانية (إن أعادها الخادم). */
  totalDuration?: number;
}

/** خيارات دالة `embed`. */
export interface EmbedOptions {
  /** عنوان الخادم (افتراضياً `DEFAULT_HOST`). */
  host?: string;
  /** نموذج التضمين (افتراضياً `DEFAULT_EMBED_MODEL` أي `bge-m3`). */
  model?: string;
  /** النص (أو النصوص) المراد تضمينه. المصفوفة تُدمج بفاصل سطرين. */
  input: string | string[];
  /** المهلة بالمللي ثانية (افتراضياً `TIMEOUT_MS`). */
  timeoutMs?: number;
  /** دالة `fetch` مخصصة (للاختبارات أو بيئات خاصة). */
  fetchFn?: typeof fetch;
}

/** رد دالة `embed` — متجه التضمين. */
export interface EmbedResponse {
  /** متجه الأعداد العشرية الممثل للنص. */
  embedding: number[];
}

/** خيارات دالة `analyzeArticle` عالية المستوى. */
export interface AnalyzeArticleOptions {
  /** عنوان الخادم (افتراضياً `DEFAULT_HOST`). */
  host?: string;
  /** نموذج التحليل (افتراضياً `DEFAULT_MODEL`). */
  model?: string;
  /** درجة الحرارة (افتراضياً `DEFAULT_TEMPERATURE`). */
  temperature?: number;
  /** المهلة بالمللي ثانية (افتراضياً `TIMEOUT_MS`). */
  timeoutMs?: number;
  /** دالة `fetch` مخصصة (للاختبارات أو بيئات خاصة). */
  fetchFn?: typeof fetch;
}

// ─── مخططات Zod ───────────────────────────────────────────────────────

/** مخطط رسالة المحادثة (للتحقق من مدخلات `chat`). */
export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

/** الشكل الخام لرد Ollama `/api/chat` (غير متدفق). */
const OllamaChatRawSchema = z.object({
  model: z.string(),
  message: z.object({
    role: z.string(),
    content: z.string(),
  }),
  done: z.boolean().default(true),
  total_duration: z.number().optional(),
});

/** الشكل الخام لرد Ollama `/api/generate` (غير متدفق). */
const OllamaGenerateRawSchema = z.object({
  model: z.string(),
  response: z.string(),
  done: z.boolean().default(true),
  total_duration: z.number().optional(),
});

/** الشكل الخام لرد Ollama `/api/embeddings`. */
const OllamaEmbeddingsRawSchema = z.object({
  embedding: z.array(z.number()),
});

/** الشكل الخام لرد Ollama `/api/tags`. */
const OllamaTagsRawSchema = z.object({
  models: z.array(z.object({ name: z.string() })).default([]),
});

/** الكيانات المستخرجة من المقال. */
export const ArticleEntitiesSchema = z.object({
  organizations: z.array(z.string()).default([]),
  people: z.array(z.string()).default([]),
  places: z.array(z.string()).default([]),
});

/**
 * نتيجة تحليل المقال — تُنتجها `analyzeArticle` بعد التحقق بـ Zod.
 * كل النصوص بالعربية الفصحى، ما عدا `confidence` (إنجليزية صغيرة).
 */
export const ArticleAnalysisSchema = z.object({
  /** ملخص المقال في 3-5 نقاط. */
  summary: z.array(z.string()).min(1),
  /** الوقائع الرئيسية المستخرجة من النص. */
  facts: z.array(z.string()).default([]),
  /** التحليل: السياق والدوافع والتداعيات المحتملة. */
  analysis: z.array(z.string()).default([]),
  /** مستوى الثقة في التحليل. */
  confidence: z.enum(["low", "medium", "high"]),
  /** الكيانات المذكورة مصنّفة. */
  entities: ArticleEntitiesSchema.default({
    organizations: [],
    people: [],
    places: [],
  }),
});

/** نوع نتيجة تحليل المقال (مستنتَج من المخطط). */
export type ArticleAnalysis = z.infer<typeof ArticleAnalysisSchema>;

// ─── الأخطاء ──────────────────────────────────────────────────────────

/**
 * خطأ HTTP من خادم Ollama (حالة غير 2xx، أو انقطاع/مهلة الشبكة).
 * يحمل `status` و `body` للتشخيص عند توفرهما.
 */
export class OllamaError extends Error {
  readonly code = "OLLAMA_ERROR";
  /** كود الحالة HTTP (غير متوفر عند أخطاء الشبكة/المهلة). */
  readonly status?: number;
  /** متن الرد الخام (للتشخيص). */
  readonly body?: string;

  constructor(message: string, opts?: { status?: number; body?: string; cause?: unknown }) {
    super(message);
    this.name = "OllamaError";
    this.status = opts?.status;
    this.body = opts?.body;
    this.cause = opts?.cause;
  }
}

/**
 * خطأ تحليل مخرجات النموذج (JSON غير صالح أو لا يطابق المخطط).
 * يحمل `raw` أي النص الخام الذي فشل تحليله.
 */
export class ParseError extends Error {
  readonly code = "OLLAMA_PARSE_ERROR";
  /** المخرجات الخام التي فشل تحليلها. */
  readonly raw: string;

  constructor(message: string, raw: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = "ParseError";
    this.raw = raw;
    this.cause = opts?.cause;
  }
}

// ─── أدوات داخلية ─────────────────────────────────────────────────────

/**
 * يوحّد عنوان الخادم ويتحمّل قيم `OLLAMA_HOST` المحطوطة بغلط:
 * - يُضيف `http://` عند غياب البروتوكول (مثال: `"127.0.0.1:11434"`)
 * - يُبدّل عنوان الـ bind `"0.0.0.0"` بـ `"127.0.0.1"` (غير قابل للاتصال به كوجهة)
 * - يُزيل أي `/` زائدة في النهاية
 * - يرجع `http://localhost:11434` عند القيمة الفارغة/غير المعرّفة
 */
export function resolveHost(host?: string): string {
  const FALLBACK = "http://localhost:11434";
  let h = (host ?? process.env.OLLAMA_HOST ?? "").trim();
  if (!h) return FALLBACK;
  h = h.replace(/\/+$/, "").trim();
  if (!h) return FALLBACK;
  if (h.includes("0.0.0.0")) h = h.replaceAll("0.0.0.0", "127.0.0.1");
  if (!/^https?:\/\//i.test(h)) h = `http://${h}`;
  return h.replace(/\/+$/, "");
}

/** يرجع النموذج المطلوب أو الافتراضي للمحادثة. */
function resolveModel(model?: string): string {
  return model?.trim() || DEFAULT_MODEL;
}

/**
 * `fetch` مع مهلة عبر `AbortController`.
 * عند انتهاء المهلة يُرمى `OllamaError` يذكر المدة.
 */
async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (ctrl.signal.aborted) {
      throw new OllamaError(`انتهت مهلة الطلب إلى ${url} بعد ${timeoutMs}ms`, { cause: err });
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new OllamaError(`تعذّر الوصول إلى Ollama (${msg})`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يقرأ جسم الرد كنص ويرمي `OllamaError` عند حالة HTTP غير ناجحة.
 * يحمل الخطأ `status` و `body` للتشخيص.
 */
async function readOkText(res: Response, url: string): Promise<string> {
  if (res.ok) return res.text();
  const body = await res.text().catch(() => "");
  throw new OllamaError(`خطأ HTTP من Ollama: ${res.status} ${res.statusText} — ${url}`, {
    status: res.status,
    body: body.slice(0, 2000),
  });
}

/**
 * يستخرج كائن JSON من نص النموذج.
 * يتسامح مع تسييج ```json ... ``` ومع أي نص زائد حول الكائن.
 * @throws {ParseError} إذا تعذّر إيجاد/تحليل JSON.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  if (!text) throw new ParseError("مخرجات النموذج فارغة — لا يوجد JSON لتحليله", raw);
  // جرّد تسييج markdown إن وُجد: ```json ... ``` أو ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  const candidate = (fenced ?? text).trim();
  // محاولة مباشرة أولاً
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    // ثم البحث عن أول { ... آخر } في النص
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new ParseError("فشل تحليل JSON من مخرجات النموذج", raw);
    }
    const slice = candidate.slice(start, end + 1);
    try {
      return JSON.parse(slice) as unknown;
    } catch (err) {
      throw new ParseError("فشل تحليل JSON من مخرجات النموذج", raw, { cause: err });
    }
  }
}

// ─── الدوال منخفضة المستوى ─────────────────────────────────────────────

/**
 * محادثة مع Ollama (`POST /api/chat`, غير متدفقة `stream: false`).
 *
 * @example
 * ```ts
 * const res = await chat({
 *   messages: [{ role: "user", content: "لخّص هذا الخبر..." }],
 * });
 * console.log(res.content);
 * ```
 */
export async function chat(opts: ChatOptions): Promise<ChatResponse> {
  if (!opts.messages || opts.messages.length === 0) {
    throw new Error("chat: يلزم تمرير رسالة واحدة على الأقل في `messages`");
  }
  for (const m of opts.messages) {
    const parsed = ChatMessageSchema.safeParse(m);
    if (!parsed.success) throw new Error(`chat: رسالة غير صالحة (${parsed.error.message})`);
  }
  const host = resolveHost(opts.host);
  const model = resolveModel(opts.model);
  const fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const url = `${host}/api/chat`;

  const messages: ChatMessage[] =
    opts.system && opts.messages[0]?.role !== "system"
      ? [{ role: "system", content: opts.system }, ...opts.messages]
      : [...opts.messages];

  const body = {
    model,
    messages,
    stream: false,
    ...(opts.format ? { format: opts.format } : {}),
    options: {
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      num_ctx: opts.numCtx ?? DEFAULT_NUM_CTX,
    },
  };

  const res = await fetchWithTimeout(
    fetchFn,
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  const text = await readOkText(res, url);
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (err) {
    throw new ParseError("رد Ollama لـ /api/chat ليس JSON صالحاً", text, { cause: err });
  }
  const parsed = OllamaChatRawSchema.safeParse(json);
  if (!parsed.success) {
    throw new ParseError(`شكل رد /api/chat غير متوقع: ${parsed.error.message}`, text, {
      cause: parsed.error,
    });
  }
  return {
    content: parsed.data.message.content,
    model: parsed.data.model,
    done: parsed.data.done,
    ...(parsed.data.total_duration !== undefined
      ? { totalDuration: parsed.data.total_duration }
      : {}),
  };
}

/**
 * توليد من prompt مفرد (`POST /api/generate`, غير متدفق).
 * مناسب للمهام البسيطة التي لا تحتاج سجل محادثة.
 *
 * @example
 * ```ts
 * const res = await generate({ prompt: "عناوين بديلة لهذا الخبر: ..." });
 * ```
 */
export async function generate(opts: GenerateOptions): Promise<ChatResponse> {
  if (!opts.prompt || opts.prompt.trim().length === 0) {
    throw new Error("generate: يلزم تمرير `prompt` غير فارغ");
  }
  const host = resolveHost(opts.host);
  const model = resolveModel(opts.model);
  const fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const url = `${host}/api/generate`;

  const body = {
    model,
    prompt: opts.prompt,
    ...(opts.system ? { system: opts.system } : {}),
    stream: false,
    ...(opts.format ? { format: opts.format } : {}),
    options: {
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      num_ctx: opts.numCtx ?? DEFAULT_NUM_CTX,
    },
  };

  const res = await fetchWithTimeout(
    fetchFn,
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  const text = await readOkText(res, url);
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (err) {
    throw new ParseError("رد Ollama لـ /api/generate ليس JSON صالحاً", text, { cause: err });
  }
  const parsed = OllamaGenerateRawSchema.safeParse(json);
  if (!parsed.success) {
    throw new ParseError(`شكل رد /api/generate غير متوقع: ${parsed.error.message}`, text, {
      cause: parsed.error,
    });
  }
  return {
    content: parsed.data.response,
    model: parsed.data.model,
    done: parsed.data.done,
    ...(parsed.data.total_duration !== undefined
      ? { totalDuration: parsed.data.total_duration }
      : {}),
  };
}

/**
 * تضمين نص (`POST /api/embeddings`) — افتراضياً بنموذج `bge-m3`.
 * عند تمرير مصفوفة نصوص تُدمج بفاصل سطرين في prompt واحد
 * (لأن نقطة `/api/embeddings` تقبل prompt مفرداً).
 *
 * @example
 * ```ts
 * const { embedding } = await embed({ input: "نص الخبر..." });
 * ```
 */
export async function embed(opts: EmbedOptions): Promise<EmbedResponse> {
  const prompt = Array.isArray(opts.input) ? opts.input.join("\n\n") : opts.input;
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("embed: يلزم تمرير `input` غير فارغ");
  }
  const host = resolveHost(opts.host);
  const model = opts.model?.trim() || DEFAULT_EMBED_MODEL;
  const fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const url = `${host}/api/embeddings`;

  const res = await fetchWithTimeout(
    fetchFn,
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt }),
    },
    timeoutMs,
  );
  const text = await readOkText(res, url);
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (err) {
    throw new ParseError("رد Ollama لـ /api/embeddings ليس JSON صالحاً", text, { cause: err });
  }
  const parsed = OllamaEmbeddingsRawSchema.safeParse(json);
  if (!parsed.success) {
    throw new ParseError(`شكل رد /api/embeddings غير متوقع: ${parsed.error.message}`, text, {
      cause: parsed.error,
    });
  }
  return { embedding: parsed.data.embedding };
}

/**
 * سرد النماذج المتاحة محلياً (`GET /api/tags`).
 * @returns أسماء النماذج (مثال: `["falcon-h1-ar:latest", "bge-m3:latest"]`).
 */
export async function listModels(host?: string, fetchFn?: typeof fetch): Promise<string[]> {
  const base = resolveHost(host);
  const fn = fetchFn ?? globalThis.fetch.bind(globalThis);
  const url = `${base}/api/tags`;
  const res = await fetchWithTimeout(fn, url, { method: "GET" }, TIMEOUT_MS);
  const text = await readOkText(res, url);
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (err) {
    throw new ParseError("رد Ollama لـ /api/tags ليس JSON صالحاً", text, { cause: err });
  }
  const parsed = OllamaTagsRawSchema.safeParse(json);
  if (!parsed.success) {
    throw new ParseError(`شكل رد /api/tags غير متوقع: ${parsed.error.message}`, text, {
      cause: parsed.error,
    });
  }
  return parsed.data.models.map((m) => m.name);
}

// ─── الدوال عالية المستوى ─────────────────────────────────────────────

/** تعليمات النظام العربية المستعملة في تحليل المقالات. */
export const ANALYZE_SYSTEM_PROMPT = `أنت محلل استخباراتي إخباري عربي في منصة ARGOS.
حلل المقال التالي وأعد JSON فقط — بدون تسييج markdown وبدون أي شرح خارج JSON — بالمفاتيح التالية حصراً:
- "summary": مصفوفة من 3 إلى 5 جمل تلخص المقال بالعربية الفصحى
- "facts": مصفوفة الوقائع الرئيسية المستخرجة حرفياً من النص
- "analysis": مصفوفة تحليل (السياق، الدوافع المحتملة، التداعيات)
- "confidence": واحدة فقط من "low" أو "medium" أو "high" (بحروف صغيرة إنجليزية)
- "entities": كائن فيه "organizations" و"people" و"places" (مصفوفات أسماء بالعربية، فارغة إن لم توجد)
قواعد صارمة: اكتب بالعربية الفصحى فقط. لا تختلق معلومات غير موجودة في النص. إذا شككت فقل "غير مؤكد".`;

/** أقصى طول لمتن المقال المُرسل للنموذج (حماية لنافذة السياق). */
export const MAX_ARTICLE_CHARS = 6000;

/**
 * يحلّل مقالاً إخبارياً ويعيد ملخصاً ووقائع وتحليلاً وكيانات.
 * يستعمل `chat` مع `format: 'json'` ثم يتحقق من النتيجة بـ Zod.
 *
 * @param article المقال (نوع `Article` من `@argos/core`).
 * @throws {ParseError} إذا أعاد النموذج JSON غير صالح أو لا يطابق المخطط.
 * @throws {OllamaError} عند فشل HTTP أو المهلة.
 */
export async function analyzeArticle(
  article: Article,
  opts?: AnalyzeArticleOptions,
): Promise<ArticleAnalysis> {
  const body = article.body.length > MAX_ARTICLE_CHARS
    ? `${article.body.slice(0, MAX_ARTICLE_CHARS)}\n…`
    : article.body;
  const userPrompt = `العنوان: ${article.title}\nالمصدر: ${article.source}\nالنص:\n${body}\n\nأعد التحليل بصيغة JSON حسب التعليمات.`;

  const res = await chat({
    host: opts?.host,
    model: opts?.model,
    messages: [{ role: "user", content: userPrompt }],
    system: ANALYZE_SYSTEM_PROMPT,
    format: "json",
    temperature: opts?.temperature ?? DEFAULT_TEMPERATURE,
    timeoutMs: opts?.timeoutMs,
    fetchFn: opts?.fetchFn,
  });

  const json = extractJson(res.content);
  const parsed = ArticleAnalysisSchema.safeParse(json);
  if (!parsed.success) {
    throw new ParseError(
      `تحليل المقال لا يطابق المخطط المتوقع: ${parsed.error.message}`,
      res.content,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
