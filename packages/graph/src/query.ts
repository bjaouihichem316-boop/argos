/**
 * @argos/graph — استعلامات Cypher للعلاقات (Phase 3).
 *
 * - `findPathBetween`: أقصر مسار بين كيانين (`shortestPath` — Cypher خالص، لا يحتاج APOC)
 * - `findArticlesMentioning`: المقالات التي تذكر كياناً
 * - `findCoOccurringEntities`: الكيانات التي تظهر مع كيان في نفس المقالات
 * - `findEntityNetwork`: الشبكة المحيطة بكيان (للتصوير)
 *
 * مطابقة الأسماء تتسامح مع الصيغ: `name` أو `nameAr` أو أحد `aliases`.
 * كل الدوال تقبل `session` اختيارية (للاختبارات) وإلا تفتح جلسة وتغلقها تلقائياً.
 */
import { ArticleSchema, type Article } from "@argos/core";
import { z } from "zod";
import { getSession, type SessionLike } from "./neo4j.js";

// ─── الأخطاء ─────────────────────────────────────────────────────────────

/** خطأ طبقة الرسم (مدخلات غير صالحة أو فشل استعلام). */
export class GraphError extends Error {
  readonly code = "GRAPH_ERROR";
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = "GraphError";
    this.cause = opts?.cause;
  }
}

// ─── الأنواع والمخططات ───────────────────────────────────────────────────

/** عقدة في مسار/شبكة. */
export const PathNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().optional(),
  name: z.string().optional(),
  nameAr: z.string().optional(),
  labels: z.array(z.string()).default([]),
});
/** عقدة في مسار/شبكة. */
export type PathNode = z.infer<typeof PathNodeSchema>;

/** مسار بين كيانين: قائمة عقد متتالية وطوله (عدد القفزات). */
export const PathSchema = z.object({
  nodes: z.array(PathNodeSchema),
  length: z.number().int().min(0),
});
/** مسار بين كيانين. */
export type Path = z.infer<typeof PathSchema>;

/** كيان متزامن مع آخر وعدد المقالات المشتركة. */
export const CoOccurrenceSchema = z.object({
  entity: PathNodeSchema,
  count: z.number().int().min(1),
});
/** كيان متزامن مع آخر. */
export type CoOccurrence = z.infer<typeof CoOccurrenceSchema>;

/** حافة في شبكة كيان. */
export const NetworkEdgeSchema = z.object({
  /** نوع العلاقة (`MENTIONS` | `CO_OCCURS_WITH` ...). */
  type: z.string().min(1),
  /** معرّف العقدة المصدر. */
  fromId: z.string().min(1),
  /** معرّف العقدة الهدف. */
  toId: z.string().min(1),
});
/** حافة في شبكة كيان. */
export type NetworkEdge = z.infer<typeof NetworkEdgeSchema>;

/** شبكة كيان للتصوير: عقد وحواف. */
export const EntityNetworkSchema = z.object({
  nodes: z.array(PathNodeSchema),
  edges: z.array(NetworkEdgeSchema),
});
/** شبكة كيان للتصوير. */
export type EntityNetwork = z.infer<typeof EntityNetworkSchema>;

// ─── أدوات داخلية ────────────────────────────────────────────────────────

/** شرط مطابقة الكيان بالاسم (يتسامح مع name/nameAr/aliases). */
const ENTITY_MATCH_WHERE =
  "WHERE e.name = $name OR e.nameAr = $name OR $name IN e.aliases";

/**
 * يستخرج حقلاً من سجل Neo4j — يعمل مع سجلات الـ driver الحقيقية
 * (`.get(key)`) ومع الـ mocks البسيطة (كائنات عادية).
 */
function fieldOf(record: unknown, key: string): unknown {
  if (record !== null && typeof record === "object") {
    const r = record as Record<string, unknown>;
    const get = r["get"];
    if (typeof get === "function") return (get as (k: string) => unknown).call(record, key);
    const toObject = r["toObject"];
    if (typeof toObject === "function") {
      return (toObject as () => Record<string, unknown>).call(record)[key];
    }
    if (key in r) return r[key];
  }
  return undefined;
}

/** يحوّل أعداد Neo4j الصحيحة (`Integer`) إلى `number` عادي. */
function toNumberSafe(value: unknown): number {
  if (typeof value === "number") return value;
  if (value !== null && typeof value === "object") {
    const v = value as { toNumber?: unknown };
    if (typeof v.toNumber === "function") {
      return (v.toNumber as () => number)();
    }
  }
  return Number(value);
}

/**
 * ينفّذ استعلاماً بجلسة ممرّرة أو بجلسة مملوكة تُغلق تلقائياً.
 * @internal يُصدَّر للاختبارات فقط.
 */
export async function runWithSession<T>(
  cypher: string,
  params: Record<string, unknown>,
  map: (records: unknown[]) => T,
  session?: SessionLike,
): Promise<T> {
  if (session) {
    const res = await session.run(cypher, params);
    return map(res.records);
  }
  const owned = getSession();
  try {
    const res = await (owned as unknown as SessionLike).run(cypher, params);
    return map(res.records);
  } finally {
    await owned.close();
  }
}

/** يتحقق من اسم كيان غير فارغ. */
function requireName(value: string, what: string): string {
  const name = value.trim();
  if (!name) throw new GraphError(`${what}: يلزم اسم كيان غير فارغ`);
  return name;
}

/** يتحقق من عمق صحيح ضمن مجال ويعيده (للدمج الآمن في Cypher). */
function requireDepth(value: number, what: string, min: number, max: number): number {
  const n = Math.floor(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new GraphError(`${what}: يلزم عدد صحيح بين ${min} و${max}`);
  }
  return n;
}

// ─── الاستعلامات ────────────────────────────────────────────────────────

/**
 * أقصر مسار بين كيانين حتى عمق `maxDepth` (افتراضياً 3).
 * Cypher خالص (`shortestPath`) — يعمل دون إضافة APOC.
 *
 * @example
 * ```ts
 * const paths = await findPathBetween("أبل", "شركة ناشئة");
 * ```
 */
export async function findPathBetween(
  entity1Name: string,
  entity2Name: string,
  maxDepth = 3,
  session?: SessionLike,
): Promise<Path[]> {
  const from = requireName(entity1Name, "findPathBetween");
  const to = requireName(entity2Name, "findPathBetween");
  const depth = requireDepth(maxDepth, "findPathBetween", 1, 10);

  const cypher = [
    "MATCH (a:Entity), (b:Entity)",
    "WHERE (a.name = $from OR a.nameAr = $from OR $from IN a.aliases)",
    "  AND (b.name = $to OR b.nameAr = $to OR $to IN b.aliases)",
    `MATCH path = shortestPath((a)-[*..${depth}]-(b))`,
    "RETURN [n IN nodes(path) | { id: n.id, kind: n.kind, name: n.name, nameAr: n.nameAr, labels: labels(n) }] AS nodes",
  ].join("\n");

  return runWithSession(
    cypher,
    { from, to },
    (records) =>
      records.map((rec) => {
        const nodes = PathNodeSchema.array().parse(fieldOf(rec, "nodes") ?? []);
        return { nodes, length: Math.max(0, nodes.length - 1) };
      }),
    session,
  );
}

/**
 * المقالات التي تذكر كياناً (عبر علاقة `MENTIONS`).
 * تُرجع `Article[]` كاملة (مطابقة لـ `ArticleSchema` من `@argos/core`).
 */
export async function findArticlesMentioning(
  entityName: string,
  session?: SessionLike,
): Promise<Article[]> {
  const name = requireName(entityName, "findArticlesMentioning");

  const cypher = [
    "MATCH (art:Article)-[:MENTIONS]->(e:Entity)",
    ENTITY_MATCH_WHERE,
    "RETURN art { .* } AS article",
  ].join("\n");

  return runWithSession(
    cypher,
    { name },
    (records) =>
      records.map((rec) => {
        const props = (fieldOf(rec, "article") ?? {}) as Record<string, unknown>;
        return ArticleSchema.parse({
          id: props["id"],
          title: props["title"],
          body: props["body"] ?? "",
          source: props["source"],
          url: props["url"],
          publishedAt: props["publishedAt"] ?? undefined,
          lang: props["lang"] ?? "ar",
          tags: props["tags"] ?? [],
        });
      }),
    session,
  );
}

/**
 * الكيانات التي تظهر مع كيان معيّن في نفس المقالات —
 * فقط التي تشترك معه في `minCount` مقال على الأقل (افتراضياً 2)، مرتبة تنازلياً.
 */
export async function findCoOccurringEntities(
  entityName: string,
  minCount = 2,
  session?: SessionLike,
): Promise<CoOccurrence[]> {
  const name = requireName(entityName, "findCoOccurringEntities");
  const min = requireDepth(minCount, "findCoOccurringEntities", 1, 1000);

  const cypher = [
    "MATCH (e:Entity)<-[:MENTIONS]-(art:Article)-[:MENTIONS]->(other:Entity)",
    ENTITY_MATCH_WHERE,
    "  AND other.id <> e.id",
    "WITH other, count(DISTINCT art) AS articleCount",
    "WHERE articleCount >= $minCount",
    "RETURN other { .*, labels: labels(other) } AS entity, articleCount",
    "ORDER BY articleCount DESC",
  ].join("\n");

  return runWithSession(
    cypher,
    { name, minCount: min },
    (records) =>
      records.map((rec) => ({
        entity: PathNodeSchema.parse(fieldOf(rec, "entity") ?? {}),
        count: toNumberSafe(fieldOf(rec, "articleCount")),
      })),
    session,
  );
}

/**
 * الشبكة المحيطة بكيان حتى عمق `depth` (افتراضياً 2) — عقد وحواف للتصوير.
 */
export async function findEntityNetwork(
  entityName: string,
  depth = 2,
  session?: SessionLike,
): Promise<EntityNetwork> {
  const name = requireName(entityName, "findEntityNetwork");
  const d = requireDepth(depth, "findEntityNetwork", 1, 5);

  const cypher = [
    "MATCH (e:Entity)",
    ENTITY_MATCH_WHERE,
    `MATCH path = (e)-[*..${d}]-(neighbor)`,
    "WITH collect(path) AS paths",
    "UNWIND paths AS p",
    "UNWIND nodes(p) AS n",
    "WITH paths, collect(DISTINCT n { .*, labels: labels(n) }) AS nodes",
    "UNWIND paths AS p2",
    "UNWIND relationships(p2) AS r",
    "RETURN nodes, collect(DISTINCT { type: type(r), fromId: startNode(r).id, toId: endNode(r).id }) AS edges",
  ].join("\n");

  return runWithSession(
    cypher,
    { name },
    (records) => {
      const nodeById = new Map<string, PathNode>();
      const edges: NetworkEdge[] = [];
      for (const rec of records) {
        for (const n of PathNodeSchema.array().parse(fieldOf(rec, "nodes") ?? [])) {
          if (!nodeById.has(n.id)) nodeById.set(n.id, n);
        }
        for (const eEdge of NetworkEdgeSchema.array().parse(fieldOf(rec, "edges") ?? [])) {
          if (!edges.some((x) => x.type === eEdge.type && x.fromId === eEdge.fromId && x.toId === eEdge.toId)) {
            edges.push(eEdge);
          }
        }
      }
      return { nodes: [...nodeById.values()], edges };
    },
    session,
  );
}
