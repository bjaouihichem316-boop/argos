/**
 * @argos/graph — مدير الاتصال بـ Neo4j (Phase 3).
 *
 * يوفّر Driver واحداً مشتركاً (singleton) يُقرأ إعداده من البيئة:
 * - `NEO4J_URI` (افتراضياً `bolt://localhost:7687`)
 * - `NEO4J_USER` (افتراضياً `neo4j`)
 * - `NEO4J_PASSWORD` (افتراضياً `argos-local-dev`)
 *
 * @example
 * ```ts
 * import { getSession, verifyConnectivity } from "@argos/graph";
 * if (await verifyConnectivity()) {
 *   const session = getSession();
 *   try {
 *     await session.run("RETURN 1 AS ok");
 *   } finally {
 *     await session.close();
 *   }
 * }
 * ```
 */
import neo4j, { type Driver, type Session } from "neo4j-driver";

/** عنوان Neo4j الافتراضي (bolt المباشر). */
export const DEFAULT_NEO4J_URI = "bolt://localhost:7687";
/** مستخدم Neo4j الافتراضي. */
export const DEFAULT_NEO4J_USER = "neo4j";
/** كلمة سر التطوير المحلي الافتراضية. */
export const DEFAULT_NEO4J_PASSWORD = "argos-local-dev";

/** إعدادات الاتصال بـ Neo4j. */
export interface Neo4jConfig {
  /** عنوان الخادم (مثال: `bolt://localhost:7687`). */
  uri: string;
  /** اسم المستخدم. */
  user: string;
  /** كلمة السر. */
  password: string;
}

/**
 * يبني إعدادات الاتصال من القيم الممرّرة أو متغيرات البيئة أو الافتراضيات.
 * الأولوية: الوسائط ← البيئة ← الافتراضيات.
 */
export function resolveNeo4jConfig(uri?: string, user?: string, password?: string): Neo4jConfig {
  return {
    uri: uri?.trim() || process.env.NEO4J_URI?.trim() || DEFAULT_NEO4J_URI,
    user: user?.trim() || process.env.NEO4J_USER?.trim() || DEFAULT_NEO4J_USER,
    password: password || process.env.NEO4J_PASSWORD || DEFAULT_NEO4J_PASSWORD,
  };
}

/** نسخة الـ Driver المشتركة (singleton) — تُنشأ عند أول استدعاء لـ `getDriver`. */
let driverInstance: Driver | undefined;

/**
 * يرجع الـ Driver المشترك، وينشئه عند أول استدعاء.
 * إنشاء الـ Driver لا يفتح اتصالاً فعلياً — الاتصال يتم عند أول session/query.
 *
 * @param uri عنوان الخادم (يُتجاهل إن وُجد singleton مسبقاً).
 * @param user اسم المستخدم.
 * @param password كلمة السر.
 */
export function getDriver(uri?: string, user?: string, password?: string): Driver {
  if (driverInstance) return driverInstance;
  const cfg = resolveNeo4jConfig(uri, user, password);
  driverInstance = neo4j.driver(cfg.uri, neo4j.auth.basic(cfg.user, cfg.password));
  return driverInstance;
}

/**
 * اختصار: يفتح session كتابة من الـ Driver المشترك.
 * على المستدعي إغلاقها بـ `await session.close()` (يفضّل في `finally`).
 */
export function getSession(): Session {
  return getDriver().session();
}

/**
 * الحد الأدنى من واجهة الجلسة الذي تحتاجه طبقة الرسم.
 * الـ `Session` الحقيقية تحقّقه بنيوياً، وجلسات الـ mock في الاختبارات
 * تطبّقه مباشرة — فيمرّر `Session` أو mock أينما طُلب `SessionLike`.
 */
export interface SessionLike {
  /** ينفّذ استعلام Cypher بوسائط مسماة. */
  run(cypher: string, params?: Record<string, unknown>): Promise<{ records: unknown[] }>;
  /** يغلق الجلسة (تُتجاهل للجلسات الممرّرة من الخارج). */
  close(): Promise<void>;
}

/**
 * يتحقق من الوصول للخادم. يرجع `true` عند نجاح الاتصال و`false` عند أي فشل
 * (خادم متوقف، بيانات اعتماد خاطئة، عنوان خاطئ) — لا يرمي أبداً.
 */
export async function verifyConnectivity(): Promise<boolean> {
  try {
    await getDriver().verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}

/**
 * يغلق الـ Driver المشترك ويصفّره (للإيقاف النظيف وفي الاختبارات).
 * آمن الاستدعاء المتكرر.
 */
export async function closeDriver(): Promise<void> {
  const d = driverInstance;
  driverInstance = undefined;
  if (d) await d.close();
}

/**
 * حقن Driver مخصص (للاختبارات فقط) — يستبدل الـ singleton.
 * @internal
 */
export function __setDriverForTests(driver: Driver): void {
  driverInstance = driver;
}
