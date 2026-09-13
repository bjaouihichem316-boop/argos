/**
 * @argos/tor — Tor (SOCKS5) fetcher via curl subprocess.
 *
 * لماذا curl؟ لأن Bun's native fetch لا يدعم SOCKS5 (فقط HTTP/HTTPS).
 * curl يدعم SOCKS5 أصلياً و مستقر منذ سنوات، و مثبّت على macOS افتراضياً.
 *
 * الاستعمال:
 *   const html = await torFetchText("https://example.com");
 *   const data = await torFetchJson(url, myZodSchema);
 *   const { isTor, ip } = await checkTor();
 */

import { z } from "zod";

/** عنوان SOCKS5 proxy الافتراضي لـ Tor daemon. */
export const DEFAULT_TOR_SOCKS = "socks5://127.0.0.1:9050";

/** مهلة الطلب الافتراضية (60 ثانية — Tor بطيء). */
export const DEFAULT_TOR_TIMEOUT_MS = 60_000;

/** User-Agent افتراضي يبدو كمتصفح حقيقي. */
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** علامة داخلية لاستخراج status code من output curl. */
const STATUS_MARKER = "###__ARGOS_STATUS__###";

export interface TorFetchOptions {
  /** SOCKS5 proxy URL. الافتراضي: DEFAULT_TOR_SOCKS. */
  socksUrl?: string;
  /** مهلة الطلب بالمللي ثانية. الافتراضي: 60000. */
  timeoutMs?: number;
  /** رؤوس HTTP إضافية (تدمج مع الافتراضية). */
  headers?: Record<string, string>;
  /** Method. الافتراضي: GET. */
  method?: "GET" | "POST";
  /** Body للـ POST. */
  body?: string;
}

/** نتيجة fetch خام. */
export interface TorFetchResult {
  status: number;
  body: string;
  url: string;
}

/** خطأ مخصص لكل عمليات Tor fetch. */
export class TorFetchError extends Error {
  public readonly code = "TOR_FETCH_ERROR" as const;
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
    opts?: { cause?: unknown },
  ) {
    super(message, opts);
    this.name = "TorFetchError";
  }
}

/** يحلّ proxy URL من options → env → default. */
function resolveSocksUrl(explicit?: string): string {
  return explicit ?? process.env.TOR_SOCKS_URL ?? DEFAULT_TOR_SOCKS;
}

/** يحيّد scheme من socks URL باش curl يفهمو. */
function stripScheme(socksUrl: string): string {
  return socksUrl.replace(/^socks5(h)?:\/\//, "");
}

/** يبني arguments curl للطلب. */
function buildCurlArgs(url: string, opts: TorFetchOptions): string[] {
  const socksUrl = resolveSocksUrl(opts.socksUrl);
  const hostPort = stripScheme(socksUrl);
  const timeoutSec = Math.ceil((opts.timeoutMs ?? DEFAULT_TOR_TIMEOUT_MS) / 1000);

  const args: string[] = [
    "-sS", // silent + show errors
    "-L", // follow redirects
    "--socks5-hostname", // SOCKS5 مع hostname resolution عبر proxy
    hostPort,
    "--max-time", String(timeoutSec),
    "--connect-timeout", "30",
    "-A", DEFAULT_UA,
    "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "-H", "Accept-Language: ar,en;q=0.9",
    "-w", `\n${STATUS_MARKER}%{http_code}`,
  ];

  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      args.push("-H", `${k}: ${v}`);
    }
  }

  if (opts.method === "POST") {
    args.push("-X", "POST");
    if (opts.body) {
      args.push("--data-binary", opts.body);
    }
  }

  args.push(url);
  return args;
}

/**
 * يجيب URL عبر curl + SOCKS5 (Tor).
 * @throws TorFetchError في حالة فشل curl أو المهلة.
 */
export async function torFetchRaw(
  url: string,
  opts: TorFetchOptions = {},
): Promise<TorFetchResult> {
  const args = buildCurlArgs(url, opts);

  let proc;
  try {
    proc = Bun.spawn(["curl", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TorFetchError(
      `تعذّر تشغيل curl (هل curl مثبّت؟): ${msg}`,
      undefined,
      url,
      { cause: err },
    );
  }

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const errMsg = stderr.trim() || `exit code ${exitCode}`;
    throw new TorFetchError(
      `curl فشل عند جلب ${url}: ${errMsg}`,
      undefined,
      url,
    );
  }

  // استخرج status من آخر سطر
  const markerIdx = stdout.lastIndexOf(STATUS_MARKER);
  if (markerIdx === -1) {
    throw new TorFetchError(
      `curl لم يرجع status code متوقع (output غير مفهوم)`,
      undefined,
      url,
    );
  }

  const statusStr = stdout.slice(markerIdx + STATUS_MARKER.length).trim();
  const status = parseInt(statusStr, 10);
  const body = stdout.slice(0, markerIdx).replace(/\n$/, "");

  if (Number.isNaN(status)) {
    throw new TorFetchError(
      `status code غير صالح من curl: "${statusStr}"`,
      undefined,
      url,
    );
  }

  return { status, body, url };
}

/**
 * يجيب URL عبر Tor و يرجّع النص (HTML, XML, إلخ).
 * @throws TorFetchError إذا كان HTTP status >= 400.
 */
export async function torFetchText(
  url: string,
  opts: TorFetchOptions = {},
): Promise<string> {
  const res = await torFetchRaw(url, opts);
  if (res.status >= 400) {
    throw new TorFetchError(
      `HTTP ${res.status} عند جلب ${url}`,
      res.status,
      url,
    );
  }
  return res.body;
}

/**
 * يجيب URL عبر Tor و يرجّع JSON مُتحقَّق منه بـ Zod.
 * @throws TorFetchError إذا فشل الاتصال، HTTP، JSON parse، أو Zod validation.
 */
export async function torFetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  opts: TorFetchOptions = {},
): Promise<T> {
  const res = await torFetchRaw(url, opts);
  if (res.status >= 400) {
    throw new TorFetchError(
      `HTTP ${res.status} عند جلب ${url}`,
      res.status,
      url,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch (err) {
    throw new TorFetchError(`رد ليس JSON صالحاً من ${url}`, res.status, url, {
      cause: err,
    });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new TorFetchError(
      `شكل JSON غير متوقع من ${url}: ${parsed.error.message}`,
      res.status,
      url,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

/**
 * يتحقق أن Tor خدام و يرجّع عنوان IP الخارجي.
 * يستعمل check.torproject.org — الطلب يمرّ عبر Tor.
 */
export async function checkTor(
  opts: TorFetchOptions = {},
): Promise<{ isTor: boolean; ip: string }> {
  const schema = z.object({ IsTor: z.boolean(), IP: z.string() });
  const data = await torFetchJson(
    "https://check.torproject.org/api/ip",
    schema,
    { ...opts, timeoutMs: opts.timeoutMs ?? 60_000 },
  );
  return { isTor: data.IsTor, ip: data.IP };
}
